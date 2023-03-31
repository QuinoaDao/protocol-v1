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

    address constant beefyVault = address(0x2F4BBA9fC4F77F16829F84181eB7C8b50F639F95); // polygon sUsdc beefy vault == moo stargate usdc token address
    address constant stargatePool = address(0x1205f31718499dBf1fCa446663B532Ef87481fe1); // polygon stargate usdc pool == stargate usdc pool token address
    address constant stargateRouter = address(0x45A01E4e04F14f7A4a6702c74187c5F6222033cd); // polygon stargate router
    uint256 constant stargatePoolId = 1;

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
    }

    function dacAddress() public view override returns(address) {
        return _dacAddress;
    }

    function underlyingAsset() external view override returns(address) {
        return _underlyingAsset;
    }

    function _balanceOfAssets(address assetAddress) internal view returns(uint256) {
        IERC20(assetAddress).balanceOf(address(this));
    }

    function depositToDelegate() external override onlyDac returns(bool) { 
        uint256 underlyingBal = _balanceOfAssets(_underlyingAsset);
        if(underlyingBal > 0) {
            IStargateRouter(stargateRouter).addLiquidity(stargatePoolId, underlyingBal, address(this));
        }

        uint256 starBal = _balanceOfAssets(stargatePool);
        if(starBal > 0) {
            IBeefyVault(beefyVault).deposit(starBal);
        } 
        else {
            revert("theres no available token balances");
        }

        return true;
    }

    function totalAssets() public view override returns(uint256) {
        uint256 totalAmount = _balanceOfAssets(_underlyingAsset);
        uint256 mooAmount = _balanceOfAssets(beefyVault);
        uint256 starAmount = _balanceOfAssets(stargatePool);

        // 1. moo token => star usdc token
        starAmount += mooAmount.mul(IBeefyVault(beefyVault).balance()).div(IBeefyVault(beefyVault).totalSupply()); 

        // 2. star usdc token => usdc token
        totalAmount += IStargatePool(stargatePool).amountLPtoLD(starAmount);

        return totalAmount;
    }

    function _calcUnderlyingToMoo(uint256 _underlying) internal returns(uint256) {
        // usdc -> star -> moo
        uint256 neededStar = _underlying.mul(IStargatePool(stargatePool).totalSupply).div(IStargatePool(stargatePool).totalLiquidity);
        uint256 neededMoo = neededStar.mul(IBeefyVault(beefyVault).totalSupply()).div(IBeefyVault(beefyVault).balance());
        return neededMoo;
    }

    function withdrawToProduct(uint256 assetAmount) external override onlyProduct returns(bool) { 
        uint256 availableAmount = _balanceOfAssets(_underlyingAsset);
        
        if (availableAmount < assetAmount) {
            uint256 neededAmount = assetAmount - availableAmount; 
            uint256 neededMoo = _calcUnderlyingToMoo(neededAmount); 
            if(neededMoo > _balanceOfAssets(beefyVault)) {
                neededMoo = _balanceOfAssets(beefyVault);
            }

            // beefy withdraw
            IBeefyVault(beefyVault).withdraw(neededMoo);

            // stargate withdraw
            IStargateRouter(stargateRouter).instantRedeemLocal(stargatePoolId, _balanceOfAssets(stargatePool), address(this));

            uint256 diffAmount = _balanceOfAssets(_underlyingAsset) - availableAmount;
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
        IBeefyVault(beefyVault).withdraw(_balanceOfAssets(beefyVault)); // withdraw all moo star usdc tokens
        IStargateRouter(stargateRouter).instantRedeemLocal(stargatePoolId, _balanceOfAssets(stargatePool), address(this)); // withdraw all star usdc tokens
        SafeERC20.safeTransfer(IERC20(_underlyingAsset), _productAddress, totalAssets()); // transfer all usdc tokens
        return true;
    }
}