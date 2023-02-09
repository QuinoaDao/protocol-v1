// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract UsdPriceModule is Ownable {

    // mapping base -> oracle (USD 고정)
    mapping(address => address) private priceFeeds;

    // mapping 추가
    function addUsdPriceFeed(address _asset, address _priceFeed) external onlyOwner {
        require(priceFeeds[_asset] == address(0));
        priceFeeds[_asset] = _priceFeed;
    }
    
    // mapping update
    function updateUsdPriceFeed(address _asset, address _priceFeed) external onlyOwner {
        require(priceFeeds[_asset] != address(0));
        priceFeeds[_asset] = _priceFeed;
    }

    // get function
    function getUsdPriceFeed(address _asset) public view returns(address) {
        return priceFeeds[_asset];
    }

    // token 1개 usd price 반환 -> 8 decimals
    function getLatestPrice(address _asset) internal view returns(uint256) {
        require(priceFeeds[_asset] != address(0), "Unsupported token");
        AggregatorV3Interface priceFeed = AggregatorV3Interface(priceFeeds[_asset]);
        (, int price, , , ) = priceFeed.latestRoundData();

        return uint256(price);
    }

    // token 1개 usd price 반환 -> 18 decimals
    function getAssetUsdPrice(address _asset) public view returns(uint256) {
        require(priceFeeds[_asset] != address(0), "Unsupported token");
        AggregatorV3Interface priceFeed = AggregatorV3Interface(priceFeeds[_asset]);
        (, int price, , , ) = priceFeed.latestRoundData();

        return uint256(price) * (10**10);
    }

    // latestRoundData(address base, address quote) -> 18 decimals
    function getAssetUsdValue(address _asset, uint256 _amount) public view returns(uint256) {
        uint256 assetPrice = getLatestPrice(_asset);
        uint256 assetDecimals = IERC20Metadata(_asset).decimals();
        if(assetDecimals < 10) { // asset decmals가 10보다 더 작은 경우 ex. USDC, USDT
            return assetPrice * _amount * (10**(10-assetDecimals));
        }
        else if(assetDecimals == 10){ // 10이랑 같은 경우 ex. ?
            return assetPrice * _amount;
        }
        else { // 더 큰 경우 ex. 대부분 18
            return (assetPrice * _amount) / (10**(assetDecimals-10));
        }
    }

    function convertAssetBalance(address _asset, uint256 _value) public view returns(uint256) {
        uint256 targetPrice = getLatestPrice(_asset); // 8 decimal
        uint256 targetAssetDecimals = IERC20Metadata(_asset).decimals(); 

        if(targetAssetDecimals < 10) { // asset decimal 10보다 적을때
            return _value / (targetPrice * (10**(10-targetAssetDecimals)));
        }
        else if (targetAssetDecimals == 10) { // 10일때
            return _value / targetPrice;
        }
        else { // asset decimal이 10보다 클 때 
            return _value * (10**(targetAssetDecimals-10)) / targetPrice;
        }
    }

}