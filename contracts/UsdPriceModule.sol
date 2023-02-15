// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IUsdPriceModule.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract UsdPriceModule is IUsdPriceModule, Ownable {

    mapping(address => address) private priceFeeds;

    function addUsdPriceFeed(address _asset, address _priceFeed) external onlyOwner {
        require(priceFeeds[_asset] == address(0));
        priceFeeds[_asset] = _priceFeed;
    }
    
    function updateUsdPriceFeed(address _asset, address _priceFeed) external onlyOwner {
        require(priceFeeds[_asset] != address(0));
        priceFeeds[_asset] = _priceFeed;
    }

    function getUsdPriceFeed(address _asset) public view returns(address) {
        return priceFeeds[_asset];
    }

    ///@dev returns 8 decimals
    function getLatestPrice(address _asset) internal view returns(uint256) {
        require(priceFeeds[_asset] != address(0), "Unsupported token");
        AggregatorV3Interface priceFeed = AggregatorV3Interface(priceFeeds[_asset]);
        (, int price, , , ) = priceFeed.latestRoundData();

        return uint256(price);
    }

    ///@notice returns 18 decimals
    function getAssetUsdPrice(address _asset) public view override returns(uint256) {
        require(priceFeeds[_asset] != address(0), "Unsupported token");
        AggregatorV3Interface priceFeed = AggregatorV3Interface(priceFeeds[_asset]);
        (, int price, , , ) = priceFeed.latestRoundData();

        return uint256(price) * (10**10);
    }

    ///@notice returns 18 decimals
    function getAssetUsdValue(address _asset, uint256 _amount) public view override returns(uint256) {
        uint256 assetPrice = getLatestPrice(_asset);
        uint256 assetDecimals = IERC20Metadata(_asset).decimals();
        if(assetDecimals < 10) { 
            return assetPrice * _amount * (10**(10-assetDecimals));
        }
        else if(assetDecimals == 10){ 
            return assetPrice * _amount;
        }
        else { 
            return (assetPrice * _amount) / (10**(assetDecimals-10));
        }
    }

    function convertAssetBalance(address _asset, uint256 _value) public view override returns(uint256) {
        uint256 targetPrice = getLatestPrice(_asset); // 8 decimal
        uint256 targetAssetDecimals = IERC20Metadata(_asset).decimals(); 

        if(targetAssetDecimals < 10) { 
            return _value / (targetPrice * (10**(10-targetAssetDecimals)));
        }
        else if (targetAssetDecimals == 10) { 
            return _value / targetPrice;
        }
        else {
            return _value * (10**(targetAssetDecimals-10)) / targetPrice;
        }
    }

}