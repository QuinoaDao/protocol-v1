// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;
 
interface IUsdPriceModule {
    function getAssetUsdPrice(address _asset) external view returns(uint256);
    function getAssetUsdValue(address _asset, uint256 _amount) external view returns(uint256);
    function convertAssetBalance(address _asset, uint256 _value) external view returns(uint256);
}