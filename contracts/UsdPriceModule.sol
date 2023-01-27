// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract UsdPriceModule is Ownable {

    // mapping base -> oracle (USD 고정)
    mapping(address => address) private priceFeeds;

    // get function
    function getUsdPriceFeed(address _asset) public view returns(address) {
        return priceFeeds[_asset];
    }

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
    
    // token 1개 usd price 반환 -> decimal 8
    function getAssetUsdPrice(address _asset) public view returns(uint256) {
        require(priceFeeds[_asset] != address(0), "Unsupported token");
        AggregatorV3Interface priceFeed = AggregatorV3Interface(priceFeeds[_asset]);
        (, int price, , , ) = priceFeed.latestRoundData();

        return uint256(price);
    }

    // latestRoundData(address base, address quote)
    function getAssetUsdValue(address _asset, uint256 _amount) public view returns(uint256) {
        uint256 assetPrice = getAssetUsdPrice(_asset);
        uint256 assetDecimals = IERC20Metadata(_asset).decimals();
        if(assetDecimals < 18) { // asset decmals가 더 작은 경우 ex. USDC, USDT

        }
        else if(assetDecimals == 0){ // 같은 경우 ex. 대부분

        }
        else { // 더 큰 경우 

        }


    }


}