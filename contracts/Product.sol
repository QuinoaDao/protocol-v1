// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IProduct.sol";
import "./IStrategy.sol";
import "./libraries/ChainlinkGateway.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract Product is ERC20, IProduct {
    using Math for uint256;

    AssetParams[] public assets;
    StrategyParams[] public strategies;
    
    ///@notice All ratios use per 100000. 
    ///ex. 100000 = 100%, 10000 = 10%, 1000 = 1%, 100 = 0.1%
    uint256 private _floatRatio;

    string private _dacName; 
    address private _dacAddress;
    uint256 private _sinceDate;

    ///@notice DAC means the owner of the product.
    ///Only dac member can call the rebalance method.
    modifier onlyDac{
        require(_msgSender()==_dacAddress);
        _;
    }
        
    constructor(
        string memory name_, 
        string memory symbol_, 
        address dacAddress_, 
        string memory dacName_, 
        address[] memory assetAddresses_, 
        address[] memory oracleAddresses_,
        uint256 floatRatio_
        ) 
        ERC20 (name_, symbol_)
    {
        
        _sinceDate = block.timestamp;

        require(dacAddress_ != address(0x0), "Invalid dac address");
        _dacAddress = dacAddress_;
        _dacName = dacName_;

        
        require(assetAddresses_.length == oracleAddresses_.length, "Invalid underlying asset parameters");
        for (uint i=0; i<assetAddresses_.length; i++){
            require(assetAddresses_[i] != address(0x0), "Invalid underlying asset address");
            assets.push(AssetParams(assetAddresses_[i], oracleAddresses_[i], 0, 0)); 
        }

        require((floatRatio_ >= 0) || (floatRatio_ <= 100000), "Invalid float ratio");
        _floatRatio = floatRatio_;
    }

    ///@notice Return current asset statistics.
    function currentAssets() external view override returns(AssetParams[] memory) {
        return assets;
    }

    ///@notice Add one underlying asset to be handled by the product. 
    ///@dev It is recommended to call updateWeight method after calling this method.
    function addAsset(address newAssetAddress, address newOracleAddress) external override {
        require(newAssetAddress!=address(0x0), "Invalid asset address");
        require(newOracleAddress!=address(0x0), "Invalid oracle address");
        require(!checkAsset(newAssetAddress), "Asset Already Exists");
        assets.push(AssetParams(newAssetAddress, newOracleAddress, 0, 0)); 
    }

    ///@notice update target weights and it will be used as a reference weight at the next rebalancing.
    function updateWeight(address[] memory assetAddresses, uint256[] memory assetWeights) external override {
        uint256 sumOfWeight = 0;
        for (uint i = 0; i < assetAddresses.length; i++) {
            bool found = false;
            for (uint j = 0; j < assets.length; j++) {
                if(assets[j].assetAddress == assetAddresses[i]) {
                    require((assetWeights[i] >= 0) || (assetWeights[i] <= 100000), "Invalid asset target weight");
                    assets[j].targetWeight = assetWeights[i];
                    sumOfWeight += assetWeights[i];
                    found = true;
                    break;
                }
            }
            require(found, "Asset not found");
        }
        require(sumOfWeight == 100000, "Sum of asset weights is not 100%");
    }

    ///@notice update target oracle address when chainlink or other oracle platform changes address.
    function updateOracleAddress(address[] memory assetAddresses, address[] memory assetOracles) external override {
        for (uint i = 0; i < assetAddresses.length; i++) {
            bool found = false;
            for (uint j = 0; j < assets.length; j++) {
                if(assets[j].assetAddress == assetAddresses[i]) {
                    require(assetOracles[i] != address(0x0), "Invalid underlying asset address");
                    assets[j].oracleAddress = assetOracles[i];
                    found = true;
                    break;
                    }
                }
            require(found, "Asset not found");
        }
    }

    ///@notice Update target float ratio. It will reflect at the next rebalancing or withdrawal.
    function updateFloatRatio(uint256 newFloatRatio) external override {
        require((newFloatRatio >= 0) || (newFloatRatio <= 100000), "Invalid float ratio");
        _floatRatio = newFloatRatio;
    }


    ///@notice Returns decimals of the product share token.
    function decimals() public view virtual override(ERC20, IERC20Metadata) returns (uint8) {
        return 18;
    } 

    ///@notice Returns dac name.
    function dacName() public view returns(string memory) {
        return _dacName;
    }

    ///@notice Returns dac address(typically equal to product deployer).
    function dacAddress() public view returns(address) {
        return _dacAddress;
    }

    ///@notice Returns the date when the product was deployed in Unix timestamp format.
    function sinceDate() public view returns(uint256) {
        return _sinceDate;
    }

    ///@notice Returns current target float ratio.
    function currentFloatRatio() public view returns(uint256) {
        return _floatRatio;
    }

    ///@notice Check if the asset address is the asset currently being handled in the product.
    function checkAsset(address _tokenAddress) public view returns (bool) {
        for (uint i = 0; i < assets.length; i++) {
            if(assets[i].assetAddress == _tokenAddress) {
                return true;
            }
        }
        return false;
    }

    ///@notice Returns the float amount for one of the underlying assets of the product.
    function assetFloatBalance(address assetAddress) public view override returns(uint256) {
        require(checkAsset(assetAddress), "Asset Doesn't Exist");
        return IERC20(assetAddress).balanceOf(address(this));
    }

    ///@notice Calculates the whole amount for one of underlying assets the product holds.
    function assetBalance(address assetAddress) public view override returns(uint256) {
        uint256 totalBalance = assetFloatBalance(assetAddress);
        for (uint i = 0; i < strategies.length; i++) {
            if(strategies[i].assetAddress == assetAddress) {
                totalBalance += IStrategy(strategies[i].strategyAddress).totalAssets();
            }
        }
        return totalBalance;
    }

    ///@notice Calculates the total value of underlying assets the product holds.
    function portfolioValue() public view override returns(uint256) {
        uint256 totalValue = 0;
        for (uint256 i=0; i<assets.length; i++) {
            totalValue += assetBalance(assets[i].assetAddress) * ChainlinkGateway.getLatestPrice(assets[i].oracleAddress);
        }
        return totalValue;
    }

    ///@notice Calculates the total value of floats the product holds.
    function totalFloatValue() public view override returns (uint256) {
        uint256 totalValue = 0;
        for (uint256 i=0; i<assets.length; i++) {
            totalValue += assetFloatBalance(assets[i].assetAddress) * ChainlinkGateway.getLatestPrice(assets[i].oracleAddress);
        }
        return totalValue;
    }

    ///@notice Calculates the value of specific underlying assets the product holds.
    function assetValue(address assetAddress) public view override returns (uint256) {
        uint totalValue = 0;
        for (uint256 i=0; i < assets.length; i++) {
            if(assets[i].assetAddress == assetAddress) {
                totalValue += assetBalance(assets[i].assetAddress) * ChainlinkGateway.getLatestPrice(assets[i].oracleAddress);
                break;
            }
        }
        return totalValue;
    }

    ///@notice Returns the float value for one of the underlying assets of the product.
    function assetFloatValue(address assetAddress) public view override returns(uint256) {
        uint totalValue = 0;
        for (uint256 i=0; i < assets.length; i++) {
            if(assets[i].assetAddress == assetAddress) {
                totalValue += assetFloatBalance(assets[i].assetAddress) * ChainlinkGateway.getLatestPrice(assets[i].oracleAddress);
                break;
            }
        }
        return totalValue;
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
            portfolioValue += assetValue(assets[i].assetAddress); // stratey + float value
        }

        for(uint i=0; i < assets.length; i++){
            uint256 targetBalance = (assets[i].targetWeight * portfolioValue) / assets[i].currentPrice;
            uint256 currentBalance = assetFloatBalance(assets[i].assetAddress); // float balance
            if (currentBalance > targetBalance) {
                // Sell
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
        
        // emit Rebalance(block.timestamp);
    }

    function maxDeposit(address receiver) external view override returns (uint256){} // for deposit
    function maxWithdraw(address owner) external view override returns (uint256){} // for withdraw

    function depositIntoStrategy(address strategyAddress, uint256 assetAmount) external override {} 
    function redeemFromStrategy(address strategyAddress, uint256 assetAmount) external override {}

    // 보류
    function convertToShares(uint256 assetAmount) external view override returns(uint256 shareAmount) {}
    function convertToAssets(uint256 shareAmount) external view override returns (uint256 assetAmount){}
}