// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IStrategy.sol";
import "./IProduct.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Strategy is IStrategy {
    address _underlyingAsset;
    address _dacAddress;
    address _productAddress;

    modifier onlyProduct {
        require(msg.sender == _productAddress, "No permission");
        _;
    }

    constructor (address dacAddress_, address underlyingAsset_, address productAddress_) {
        _dacAddress = dacAddress_;

        require(underlyingAsset_ != address(0x0), "Invalid underlying asset address");
        _underlyingAsset = underlyingAsset_;

        require(productAddress_ != address(0x0), "Invalid product address");
        _productAddress = productAddress_;
    }

    function dacAddress() public view override returns(address) {
        return _dacAddress;
    }

    function underlyingAsset() external view override returns(address) {
        return _underlyingAsset;
    }

    function totalAssets() public view override returns(uint256) {
        return 0;
    }

    function withdrawToProduct(uint256 assetAmount) external override onlyProduct returns(bool) {
        return true;
    }

    function withdrawAllToProduct() external onlyProduct returns(bool) {
        return true;
    }
}