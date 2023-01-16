// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

interface IStrategy {
    function withdrawToVault(uint256 assetAmount) external;
    function depositFromVault(uint256 assetAmount) external;
    function totalAssets() external view returns(uint256);
}