// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Strategy is IStrategy {

    address _underlyingAsset;
    address _dacAddress;
    address _productAddress;

    modifier onlyDac {
        require(msg.sender == _dacAddress, "No permission");
        _;
    }

    modifier onlyProduct {
        require(msg.sender == _productAddress, "No permission");
        _;
    }

    constructor (address underlyingAsset_, address productAddress_) {
        _dacAddress = msg.sender;

        require(_underlyingAsset != address(0x0), "Invalid underlying asset address");
        _underlyingAsset = underlyingAsset_;

        require(_productAddress != address(0x0), "Invalid product address");
        _productAddress = productAddress_;
    }

    function dacAddress() external view override returns(address) {
        return _dacAddress;
    }

    function withdrawToProduct(uint256 assetAmount) external override onlyProduct returns(bool) {
        // safeTransfer -> 실패하면 revert
        SafeERC20.safeTransfer(IERC20(_underlyingAsset), _productAddress, assetAmount); // token, to, value
        return true;
    }

    function totalAssets() external view override returns(uint256) {
        return IERC20(_underlyingAsset).balanceOf(address(this));
    }

    function underlyingAsset() external view override returns(address) {
        return _underlyingAsset;
    }
}