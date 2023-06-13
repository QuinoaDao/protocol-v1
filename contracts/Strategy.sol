// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IStrategy.sol";
import "./IProduct.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Strategy is IStrategy {

    // strategy state variables
    address public dac;
    address public product;
    address immutable public underlyingAsset;

    modifier onlyProduct {
        require(msg.sender == product, "No permission: only product");
        _;
    }

    modifier onlyDac {
        require(msg.sender == dac, "No permission: only dac");
        _;
    }

    constructor (address dac_, address underlyingAsset_,address product_) {
        require(dac_ != address(0x0), "Invalid dac address");
        dac = dac_;

        require(underlyingAsset_ != address(0x0), "Invalid underlying asset address");
        underlyingAsset = underlyingAsset_;

        require(product_ != address(0x0), "Invalid product address");
        product = product_;
    }

    function totalAssets() public view override returns(uint256) {
        return IERC20(underlyingAsset).balanceOf(address(this));
    }

    function withdraw(uint256 assetAmount) external override onlyProduct returns(bool) {
        if(assetAmount > 0) SafeERC20.safeTransfer(IERC20(underlyingAsset), product, assetAmount);
        return true;
    }

    function withdrawAll() external onlyProduct returns(bool) {
        // If product is in activation state, Dac cannot call this method
        require(!IProduct(product).checkActivation(), "Product is active now");
        SafeERC20.safeTransfer(IERC20(underlyingAsset), product, totalAssets());
        return true;
    }


    // Todo: this strategy have no real strategy logic
    function deposit() external override {
    }

    function delegate() external pure override returns(address) {
        return address(0);
    }

    function yield() external pure override returns(address) {
        return address(0);
    }
}