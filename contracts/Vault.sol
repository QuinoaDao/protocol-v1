// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IVault.sol";

contract Vault is IVault {

    function totalAssets() public view override returns (uint256) {

    }

    function convertToShares(uint256 assets) public view override returns (uint256 shares) {

    }

    function convertToAssets(uint256 shares) public view override returns (uint256 assets) {

    }

    function maxDeposit(address receiver) public view override returns (uint256) {

    }

    function previewDeposit(uint256 assets) public view override returns (uint256) {

    }

    function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {

    }

    function maxMint(address receiver) public view override returns (uint256) {

    }

    function previewMint(uint256 shares) public view  override returns (uint256) {

    }

    function mint(uint256 shares, address receiver) public override returns (uint256 assets) {

    }

    function maxWithdraw(address owner) public view override returns (uint256) {

    }

    function previewWithdraw(uint256 assets) public view override returns (uint256) {

    }

    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256 shares) {

    }

    function maxRedeem(address owner) public view override returns (uint256) {

    }

    function previewRedeem(uint256 shares) public view override returns (uint256) {

    }

    function redeem(uint256 shares, address receiver, address owner) public override returns (uint256 assets) {

    }

    function totalSupply() public view override returns (uint256) {

    }

    function balanceOf(address owner) public view override returns (uint256) {

    }


}