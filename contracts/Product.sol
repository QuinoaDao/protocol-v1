// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IProduct.sol";
import "./IStrategy.sol";
import "./libraries/ChainlinkGateway.sol";

abstract contract Product is IProduct {

    AssetParams[] public assets;
    StrategyParams[] public strategies;
    uint256 floatRatio;
        
    constructor() {
        // approve
        floatRatio = 40;
    }

    ///@notice total values of tokens in float
    function totalFloat() public view returns(uint256) {
        uint256 totalValue = 0;
        for (uint256 i=0; i < assets.length; i++) {
            totalValue += balanceOfAsset(assets[i].assetAddress)*ChainlinkGateway.getLatestPrice(assets[i].oracleAddress);
        }
        return totalValue;
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
        uint256 portfolioValue = 0;
        for (uint256 i=0; i < assets.length; i++) {
            portfolioValue += getAssetValue(assets[i].assetAddress);
        }
        return portfolioValue;
    }

    function getAssetValue(address assetAddress) public view returns (uint256) {
        require(checkAsset(assetAddress), "Asset Doesn't Exist");

        // TODO get asset values of each asset
        // considering float and assets in strategy
        // 1. get asset amount from strategies related
            // strategies의 totalAsset() 불러오는지 결정 필요. 만약 전자라면 언제 Param 업데이트 해아하는지 결정 필요.
        // 2. add it the float amount of that token
        // uint256 floatAmount = balanceOfAsset(assetAddress);
        // 3. get values by multiplying the asset price
    }

    /// @notice Token Amount of float token corresponding to param. 
    function balanceOfAsset(address assetAddress) public view returns (uint256) {
        require(checkAsset(assetAddress), "Asset Doesn't Exist");
        // uint256 strategyAsset
        uint256 totalBalance = IERC20(assetAddress).balanceOf(address(this));
        for (uint i = 0; i < strategies.length; i++) {
            if(strategies[i].assetAddress == assetAddress) {
                totalBalance += IStrategy(strategies[i].strategyAddress).totalAssets();
            }
        }
        return totalBalance;
    }

    function addAsset(address newAssetAddress, address newOracleAddress) external {
        require(!checkAsset(newAssetAddress), "Asset Already Exists");
        assets.push(AssetParams(newAssetAddress, newOracleAddress, 0, 0)); 
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
        uint256 portfolioValue = 0;
        for (uint i = 0; i < assets.length; i++) {
            assets[i].currentPrice = ChainlinkGateway.getLatestPrice(assets[i].assetAddress);
            portfolioValue += getAssetValue(assets[i].assetAddress);
        }

        for(uint i=0; i < assets.length; i++){
            uint256 targetBalance = (assets[i].targetWeight * portfolioValue) / assets[i].currentPrice;
            uint256 currentBalance = balanceOfAsset(assets[i].assetAddress);
            if (currentBalance > targetBalance) {
                // Sell
                // float으로 충분할 경우
                uint256 sellAmount = currentBalance - targetBalance;
                
                // float으로 부족할 경우
                    
                // withdrawFromStrategy()
                
            }
            else if (currentBalance < targetBalance) {
                // Buy
                // float으로 충분할 경우
                uint256 buyAmount = targetBalance - currentBalance;

                // float으로 부족할 경우
            }

            // depositIntoStrategy()

            
        }
        
        emit Rebalance(block.timestamp);
    }


}