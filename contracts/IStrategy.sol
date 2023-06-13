// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;
 
interface IStrategy {
    // for public variables
    function underlyingAsset() external view returns(address);
    function dac() external view returns(address);
    function product() external view returns(address);

    function delegate() external view returns(address); // interacting with delegate platform's deposit / withdraw 
    function yield() external view returns(address); // interfacting with yield platform's deposit / withdraw

    // view function
    function totalAssets() external view returns(uint256);

    // for interacting with product
    function withdraw(uint256 assetAmount) external returns(bool);
    function deposit() external;
}