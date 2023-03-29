// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;
 
interface IStrategy {
    function withdrawToProduct(uint256 assetAmount) external returns(bool);
    function function depositToDelegate() external returns(bool);
    function totalAssets() external view returns(uint256);
    function underlyingAsset() external view returns(address);
    function dacAddress() external view returns(address);
}