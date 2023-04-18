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

    // strategy state variables
    address public dac;
    address public product;
    address immutable public underlyingAsset;
    
    // for yield 
    address public delegate; // Beefy vault
    address public yield; // stargate router
    address public yieldPool; // stargate pool

    modifier onlyProduct {
        require(msg.sender == product, "No permission: only product");
        _;
    }

    modifier onlyDac {
        require(msg.sender == dac, "No permission: only dac");
        _;
    }

    constructor (address dac_, address product_) {
        underlyingAsset = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174; // polygon usdc (immutable)
        
        require(dac_ != address(0x0), "Invalid dac address");
        dac = dac_;
        require(product_ != address(0x0), "Invalid product address");
        product = product_;

        // stargate & beefy setting
        yield = 0x45A01E4e04F14f7A4a6702c74187c5F6222033cd; // stargate router for deposit/withdrawal logic
        yieldPool = 0x1205f31718499dBf1fCa446663B532Ef87481fe1; // stargate USDC pool
        delegate = 0x2F4BBA9fC4F77F16829F84181eB7C8b50F639F95; // beefy USDC LP pool
    }

    function deposit() external override onlyDac { 
        uint256 underlyingAmount = _availableUnderlyings();
        if(underlyingAmount > 0) {
            uint256 poolId = IStargatePool(yieldPool).poolId();

            IERC20(underlyingAsset).approve(yield, underlyingAmount);
            IStargateRouter(yield).addLiquidity(poolId, underlyingAmount, address(this));
        }

        uint256 starAmount = IStargatePool(yieldPool).balanceOf(address(this));
        if(starAmount > 0) {
            IERC20(yieldPool).approve(delegate, starAmount);
            IBeefyVault(delegate).depositAll();
        } 
        else {
            revert("theres no available token balances");
        }
    }

    function totalAssets() public view override returns(uint256) {
        uint256 totalAmount = _availableUnderlyings();
        uint256 mooAmount = IBeefyVault(delegate).balanceOf(address(this));
        uint256 starAmount = IStargatePool(yieldPool).balanceOf(address(this));

        // 1. moo token => star usdc token
        starAmount += mooAmount * IBeefyVault(delegate).balance() / IBeefyVault(delegate).totalSupply();

        // 2. star usdc token => usdc token
        totalAmount += IStargatePool(yieldPool).amountLPtoLD(starAmount);

        return totalAmount;
    }

    function withdraw(uint256 assetAmount) external override onlyProduct returns(bool) { 
        uint256 availableAmount = _availableUnderlyings(); 
        
        if (availableAmount < assetAmount) { 
            uint256 neededAmount = assetAmount - availableAmount;
            uint256 neededMoo = _calcUnderlyingToMoo(neededAmount);
            uint256 availableMoo = IBeefyVault(delegate).balanceOf(address(this));

            if(neededMoo > availableMoo || assetAmount >= totalAssets()) {
                neededMoo = availableMoo;
            }

            _withdraw(neededMoo);

            // Todo: return loss, usdc balance ... for reporting withdraw result
            uint256 diffAmount = _availableUnderlyings() - availableAmount;
            if(diffAmount < neededAmount) { 
                assetAmount = diffAmount + availableAmount;
            }
        }
        
        // usdc transfer
        if(assetAmount > 0) SafeERC20.safeTransfer(IERC20(underlyingAsset), product, assetAmount);

        return true;
    }

    function withdrawAll() external onlyProduct returns(bool) {
        // withdraw all moo & stargate tokens and transfer usdc tokens to product contracts
        require(!IProduct(product).checkActivation(), "Product is active now");
        
        uint256 availableMoo = IBeefyVault(delegate).balanceOf(address(this));
        _withdraw(availableMoo);
        
        SafeERC20.safeTransfer(IERC20(underlyingAsset), product, _availableUnderlyings()); // transfer all usdc tokens
        return true;
    }

    function _availableUnderlyings() internal view returns(uint256) {
        return IERC20(underlyingAsset).balanceOf(address(this));
    }
    
    function _calcUnderlyingToMoo(uint256 underlying) internal view returns(uint256) {
        // usdc -> star -> moo
        uint256 neededStar = underlying * IStargatePool(yieldPool).totalSupply() / IStargatePool(yieldPool).totalLiquidity();
        uint256 neededMoo = neededStar * IBeefyVault(delegate).totalSupply() / IBeefyVault(delegate).balance();
        return neededMoo;
    }

    function _withdraw(uint256 mooAmount) internal {
        // beefy withdraw
        if(mooAmount > 0) IBeefyVault(delegate).withdraw(mooAmount);

        // stargate withdraw
        uint256 poolId = IStargatePool(yieldPool).poolId();
        uint256 starAmount = IStargatePool(yieldPool).balanceOf(address(this));
        if(starAmount > 0) IStargateRouter(yield).instantRedeemLocal(uint16(poolId), starAmount, address(this));
    }
}