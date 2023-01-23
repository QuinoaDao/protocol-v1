// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IProduct.sol";
import "./libraries/ChainlinkGateway.sol";

abstract contract Product is IProduct {

    AssetParams[] public assets;
    StrategyParams[] public strategies;
    // rebalancing threshold
    
    constructor() {
        // approve
    }

    function checkAsset(address _tokenAddress) public view returns (bool) {
        for (uint i = 0; i < assets.length; i++) {
            if(assets[i].assetAddress == _tokenAddress) {
                return true;
            }
        }
        return false;
    }

    function getPortfolioValue() public view returns (uint256) {
        // TODO calculate total values of assets in this product
        // get values from strategies and add it to the float

        // Use getAssetValue
    }


    function getAssetValue(address assetAddress) public view returns (uint256) {
        // TODO get asset values of each asset
        // considering float and assets in strategy
    }

    // TODO addAsset 이후에 updateWeight호출 필요해보임
    function addAsset(address newAssetAddress, address newOracleAddress) external {
        require(!checkAsset(newAssetAddress), "Asset Already Exists");
        assets.push(AssetParams(newAssetAddress, newOracleAddress, 0, 0)); // TODO default target weight, default currentPrice
    }

    function updateWeight(AssetParams[] memory newParams) public {
        for (uint i = 0; i < newParams.length; i++) {
            bool found = false;
            for (uint j = 0; j < assets.length; j++) {
                if(assets[j].assetAddress == newParams[i].assetAddress) {
                    assets[j] = newParams[i];
                    found = true;
                    break;
                    }
                }
        require(found, "Asset not found");
        }
    }

    function currentWeight() external view returns(AssetParams[] memory) {
        return assets;
    }

    function deposit(address assetAddress, uint256 assetAmount, address receiver) external returns (uint256 shares) {
        require(checkAsset(assetAddress), "Asset not found");
        
        // TODO
        // Deposit Logic 

        emit Deposit(msg.sender, receiver, assetAmount, shares);
        return shares;
    }

    function withdraw(address assetAddress, uint256 assetAmount, address receiver, address owner) external returns (uint256 shares) {
        require(checkAsset(assetAddress), "Asset not found");
        
        // TODO
        // Withdraw Logic, 
        // float check
        // asset balance substracted
        // Transfer to user
        // burn share
        
        emit Withdraw(msg.sender, receiver, owner, assetAmount, shares);
        return shares;
    }

    function rebalance() external {
        for (uint i = 0; i < assets.length; i++) {
            assets[i].currentPrice = ChainlinkGateway.getLatestPrice(assets[i].assetAddress);
        }

        uint256 portfolioValue = getPortfolioValue();

        for(uint i=0; i < assets.length; i++){
            uint256 targetValue = (assets[i].targetWeight * portfolioValue) / 100;
            // TODO getAssetValue
            uint256 currentAssetValue = getAssetValue(assets[i].assetAddress);
    
            if(currentAssetValue > targetValue) {
                // Sell
            }
            else if(currentAssetValue < targetValue) {
                // Buy 
            }
        }
        
        emit Rebalance(block.timestamp);
    }


}