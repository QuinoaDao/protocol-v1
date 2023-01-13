// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

interface IVault {
    // MUST be emitted when tokens are deposited into the vault via the mint and deposit methods
    event Deposit(
        address indexed sender,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    // MUST be emitted when shares are withdrawn from the vault by a depositor in the redeem or withdraw methods.
    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 share
    );

    function totalAssets() external view returns (uint256);
    function convertToShares(uint256 assets) external view returns(uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function maxDeposit(address receiver) external view returns (uint256);
    function previewDeposit(uint256 assets) external view returns (uint256);
    function maxMint(address receiver) external view returns (uint256);
    function previewMint(uint256 shares) external view returns (uint256);
    function maxWithdraw(address owner) external view returns (uint256);
    function previewWithdraw(uint256 assets) external view returns (uint256);
    function maxRedeem(address owner) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);



    function addAsset() external;
    function updateWeight() external;
    function currentWeight() external;
    function checkAsset() external;

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function rebalance() external;
    function mint(uint256 shares, address receiver) external returns (uint256 assets);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);


    function depositIntoStrategy() external;
    function redeemFromStrategy() external;


}