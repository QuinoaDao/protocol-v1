// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IStrategy.sol";
import "./IProduct.sol";
import "./interfaces/IBalancerVault.sol";
import "./interfaces/IBalancerPool.sol";
import "./interfaces/IBeefyVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "hardhat/console.sol";

contract WethStrategy is IStrategy {
    using SafeERC20 for IERC20;

    // strategy state variables
    address public dac;
    address public product;
    address immutable public underlyingAsset;

    // for yield 
    address public delegate; // Beefy vault
    address public yield; // Balancer vault
    address public yieldPool; // Balancer wstETH StablePool

    modifier onlyProduct {
        require(msg.sender == product, "No permission: only product");
        _;
    }

    modifier onlyDac {
        require(msg.sender == dac, "No permission: only dac");
        _;
    }

    constructor(address dac_, address product_) {
        underlyingAsset = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619; // polygon weth (immutable)
        
        require(dac_ != address(0x0), "Invalid dac address");
        dac = dac_;
        require(product_ != address(0x0), "Invalid product address");
        product = product_;

        delegate = 0x1d81c50d5aB5f095894c41B41BA49B9873033399; // Beefy vault
        yield = 0xBA12222222228d8Ba445958a75a0704d566BF2C8; // Balancer vault
        yieldPool = 0x65Fe9314bE50890Fb01457be076fAFD05Ff32B9A; // Balancer wstETH StablePool

    }

    function totalAssets() public view override returns(uint256) {
        // return totalAmount;
        uint256 totalAmount = _availableUnderlyings();
        uint256 mooAmount = IBeefyVault(delegate).balanceOf(address(this));
        uint256 bptAmount = IBalancerPool(yieldPool).balanceOf(address(this));

        // 1. mooToken => balancer bpt token
        bptAmount += mooAmount * IBeefyVault(delegate).balance() / IBeefyVault(delegate).totalSupply();

        // 2. bpt token => weth token
        // Note: The pool.getRate() function returns the exchange rate of 
        // a BPT to the underlying base asset of the pool accounting for rate providers, if they exist. 
        totalAmount += bptAmount * IBalancerPool(yieldPool).getRate() / 1e18;

        return totalAmount;
    }

    function deposit() external override onlyDac {
        console.log("in deposit func");

        uint256 underlyingAmount = _availableUnderlyings();
        console.log("underlying amount: ", underlyingAmount);

        if(underlyingAmount > 0) { 
            IERC20(underlyingAsset).approve(yield, underlyingAmount);
            _joinPool(underlyingAmount);
            console.log("join pool is end");
        }

        uint256 bptAmount = IBalancerPool(yieldPool).balanceOf(address(this));
        console.log("bpt amount: ", bptAmount);
        
        if(bptAmount > 0){
            IBeefyVault(delegate).depositAll();
        }
        else {
            revert("thers no available token balances");
        }
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

            // withdraw in beefy
            IBeefyVault(delegate).withdraw(neededMoo);

            // exit pool in balancer
            uint256 bptAmount = IBalancerPool(yieldPool).balanceOf(address(this));
            _exitPool(bptAmount);

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
        require(!IProduct(product).checkActivation(), "Product is active now");
        // withdraw in beefy
        IBeefyVault(delegate).withdrawAll();

        // exit pool in balancer
        uint256 bptAmount = IBalancerPool(yieldPool).balanceOf(address(this));
        if(bptAmount > 0) _exitPool(bptAmount);

        // transfer all weth to product
        IERC20(underlyingAsset).safeTransfer(product, _availableUnderlyings()); 
        return true;
    }

    function _availableUnderlyings() internal view returns(uint256) {
        return IERC20(underlyingAsset).balanceOf(address(this));
    }

    function _calcUnderlyingToMoo(uint256 _underlying) internal view returns(uint256) {
        // usdc -> bpt -> moo
        uint256 neededBpt = _underlying * 1e18 / IBalancerPool(yieldPool).getRate();
        uint256 neededMoo = neededBpt * IBeefyVault(delegate).totalSupply() / IBeefyVault(delegate).balance();
        return neededMoo;
    }

    function _joinPool(uint256 underlyingAmount) internal {
        console.log("in join pool - underlying amount: ", underlyingAmount);

        bytes32 poolId = IBalancerPool(yieldPool).getPoolId();

        (address[] memory assets,,) = IBalancerVault(yield).getPoolTokens(poolId);
        uint256[] memory amountsIn = new uint256[](assets.length);
        for (uint256 i=0; i < amountsIn.length; i++) {
            amountsIn[i] = assets[i] == underlyingAsset ? underlyingAmount : 0;
        }
        bytes memory userData = abi.encode(1, amountsIn, 1);
        
        console.log(assets.length);
        for(uint256 i=0; i < assets.length; i++) {
            console.log("Assets #", i, " : ", assets[i]);
        }
        console.log(amountsIn.length);
        for(uint256 i=0; i < amountsIn.length; i++) {
            console.log("Assets amountsIn #", i, " : ", amountsIn[i]);
        }

        IBalancerVault.JoinPoolRequest memory request = IBalancerVault.JoinPoolRequest(assets, amountsIn, userData, false);

        console.log("call joinPool func");
        IBalancerVault(yield).joinPool(poolId, address(this), address(this), request);
        console.log("ends");
    }

    function _exitPool(uint256 bptAmount) internal {
        bytes32 poolId = IBalancerPool(yieldPool).getPoolId();
        
        (address[] memory assets,,) = IBalancerVault(yield).getPoolTokens(poolId);
        // Withdraw all available funds regardless of slippage
        uint256[] memory amountsOut = new uint256[](assets.length); 

        bytes memory userData = abi.encode(0, bptAmount, 1); // kind, bptIn, exitTokenIndex

        IBalancerVault.ExitPoolRequest memory request = IBalancerVault.ExitPoolRequest(assets, amountsOut, userData, false);

        IBalancerVault(yield).exitPool(poolId, address(this), address(this), request);
    }
}