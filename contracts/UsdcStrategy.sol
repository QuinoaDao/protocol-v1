// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IStrategy.sol";
import "./IProduct.sol";
import "./interfaces/IStargateRouter.sol";
import "./interfaces/IStargatePool.sol";
import "./interfaces/IBeefyVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UsdcStrategy is IStrategy {
    // internal state variables
    address _dacAddress;
    address _productAddress;
    address immutable _underlyingAsset;
    
    IBeefyVault beefyVault;
    IStargateRouter stargateRouter;
    IStargatePool stargatePool;
    uint16 stargatePoolId;

    modifier onlyProduct {
        require(msg.sender == _productAddress, "No permission: only product");
        _;
    }

    modifier onlyDac {
        require(msg.sender == _dacAddress, "No permission: only dac");
        _;
    }

    constructor (address dacAddress_, address productAddress_) {
        _underlyingAsset = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174; // polygon usdc (immutable)
        
        require(dacAddress_ != address(0x0), "Invalid dac address");
        _dacAddress = dacAddress_;
        require(productAddress_ != address(0x0), "Invalid product address");
        _productAddress = productAddress_;

        // stargate & beefy setting
        beefyVault = IBeefyVault(0x2F4BBA9fC4F77F16829F84181eB7C8b50F639F95);
        stargateRouter = IStargateRouter(0x45A01E4e04F14f7A4a6702c74187c5F6222033cd);
        stargatePool = IStargatePool(0x1205f31718499dBf1fCa446663B532Ef87481fe1);
        stargatePoolId = 1;
    }

    function dacAddress() public view override returns(address) {
        return _dacAddress;
    }

    function underlyingAsset() external view override returns(address) {
        return _underlyingAsset;
    }

    function depositToDelegate() external override onlyDac returns(bool) { 
        uint256 underlyingAmount = _availableUnderlyings();
        if(underlyingAmount > 0) {
            stargateRouter.addLiquidity(stargatePoolId, underlyingAmount, address(this));
        }

        uint256 starAmount = stargatePool.balanceOf(address(this));
        if(starAmount > 0) {
            beefyVault.depositAll();
        } 
        else {
            revert("theres no available token balances");
        }

        return true;
    }

    function totalAssets() public view override returns(uint256) {
        uint256 totalAmount = _availableUnderlyings();
        uint256 mooAmount = beefyVault.balanceOf(address(this));
        uint256 starAmount = stargatePool.balanceOf(address(this));

        // 1. moo token => star usdc token
        starAmount += mooAmount * beefyVault.balance() / beefyVault.totalSupply();

        // 2. star usdc token => usdc token
        totalAmount += stargatePool.amountLPtoLD(starAmount);

        return totalAmount;
    }

    function withdrawToProduct(uint256 assetAmount) external override onlyProduct returns(bool) { 
        uint256 availableAmount = _availableUnderlyings(); 
        
        if (availableAmount < assetAmount) { // b < r
            uint256 neededAmount = assetAmount - availableAmount;
            uint256 neededMoo = _calcUnderlyingToMoo(neededAmount);
            if(neededMoo > beefyVault.balanceOf(address(this))) {
                neededMoo = beefyVault.balanceOf(address(this));
            }

            // beefy withdraw
            beefyVault.withdraw(neededMoo);

            // stargate withdraw
            stargateRouter.instantRedeemLocal(stargatePoolId, stargatePool.balanceOf(address(this)), address(this));

            // Todo: return loss, usdc balance ... for reporting withdraw result
            uint256 diffAmount = _availableUnderlyings() - availableAmount;
            if(diffAmount < neededAmount) { 
                assetAmount = diffAmount + availableAmount;
            }
        }
        
        // usdc transfer
        if(assetAmount > 0) SafeERC20.safeTransfer(IERC20(_underlyingAsset), _productAddress, assetAmount);

        return true;
    }

    function withdrawAllToProduct() external onlyProduct returns(bool) {
        // withdraw all moo & stargate tokens and transfer usdc tokens to product contracts
        require(!IProduct(_productAddress).checkActivation(), "Product is active now");
        beefyVault.withdrawAll(); // withdraw all moo star usdc tokens
        stargateRouter.instantRedeemLocal(stargatePoolId, stargatePool.balanceOf(address(this)), address(this)); // withdraw all star usdc tokens
        SafeERC20.safeTransfer(IERC20(_underlyingAsset), _productAddress, _availableUnderlyings()); // transfer all usdc tokens
        return true;
    }

    function _availableUnderlyings() internal view returns(uint256) {
        return IERC20(_underlyingAsset).balanceOf(address(this));
    }
    
    function _calcUnderlyingToMoo(uint256 _underlying) internal view returns(uint256) {
        // usdc -> star -> moo
        uint256 neededStar = _underlying * stargatePool.totalSupply() / stargatePool.totalLiquidity();
        uint256 neededMoo = neededStar * beefyVault.totalSupply() / beefyVault.balance();
        return neededMoo;
    }

}