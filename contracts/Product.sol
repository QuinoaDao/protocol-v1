// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IProduct.sol";
import "./IStrategy.sol";
import "./libraries/ChainlinkGateway.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

abstract contract Product is ERC20, IProduct {
    using Math for uint256;

    AssetParams[] public assets;
    StrategyParams[] public strategies;
    uint256 floatRatio; // 10만분율

    string private _dacName; // DB가 없어서 contract에서도 필요한 듯
    address private _dacAddress; // 애초에 필요
    uint256 private _sinceDate;

    modifier onlyDac{
        require(_msgSender()==_dacAddress);
        _;
    }
        
    constructor(
        string memory name_, 
        string memory symbol_, 
        string memory dacName_, 
        address dacAddress_, 
        AssetParams[] memory assets_, // 괜찮은가 ?
        uint256 floatRatio_
        ) 
        ERC20(name_, symbol_)
    {
        _dacName = dacName_;
        require(dacAddress_ != address(0x0), "Invalid dac address");
        _dacAddress = dacAddress_;
        _sinceDate = block.timestamp;
        assets = assets_;
        require((floatRatio_ < 0) || (floatRatio_ > 100000), "Invalid float ratio");
        floatRatio = floatRatio_;
    }

    function decimals() public view virtual override(ERC20, IERC20Metadata) returns (uint8) {
        return 18;
    } 

    function dacName() public view returns(string memory) {
        return _dacName;
    }

    function dacAddress() public view returns(address) {
        return _dacAddress;
    }

    function sinceDate() public view returns(uint256) {
        return _sinceDate;
    }

    function currentFloatRatio() public view returns(uint256) {
        return floatRatio;
    }

    function checkAsset(address _tokenAddress) public view returns (bool) {
        for (uint i = 0; i < assets.length; i++) {
            if(assets[i].assetAddress == _tokenAddress) {
                return true;
            }
        }
        return false;
    }

    ///@notice float (amount)
    function assetFloatBalance(address assetAddress) public view override returns(uint256) {
        require(checkAsset(assetAddress), "Asset Doesn't Exist");
        return IERC20(assetAddress).balanceOf(address(this));
    }

    ///@notice strategy + float (1 asset, amount)
    function assetBalance(address assetAddress) public view override returns(uint256) {
        uint256 totalBalance = assetFloatBalance(assetAddress);
        for (uint i = 0; i < strategies.length; i++) {
            if(strategies[i].assetAddress == assetAddress) {
                totalBalance += IStrategy(strategies[i].strategyAddress).totalAssets();
            }
        }
        return totalBalance;
    }

    ///@notice stratey + float (dollar)
    function portfolioValue() public view override returns(uint256) {
        uint256 totalValue = 0;
        for (uint256 i=0; i<assets.length; i++) {
            totalValue += assetBalance(assets[i].assetAddress) * ChainlinkGateway.getLatestPrice(assets[i].oracleAddress);
        }
        return totalValue;
    }

    ///@notice strategy + float (1 asset, dollar)
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

    ///@notice float (all asset, dollar)
    function totalFloatValue() public view override returns (uint256) {
        uint256 totalValue = 0;
        for (uint256 i=0; i<assets.length; i++) {
            totalValue += assetFloatBalance(assets[i].assetAddress) * ChainlinkGateway.getLatestPrice(assets[i].oracleAddress);
        }
        return totalValue;
    }

    function addAsset(address newAssetAddress, address newOracleAddress) external {
        require(!checkAsset(newAssetAddress), "Asset Already Exists");
        assets.push(AssetParams(newAssetAddress, newOracleAddress, 0, 0)); 
    }

    function updateWeight(address[] memory assetAddresses, uint256[] memory assetWeights) public {
        for (uint i = 0; i < assetAddresses.length; i++) {
            bool found = false;
            for (uint j = 0; j < assets.length; j++) {
                if(assets[j].assetAddress == assetAddresses[i]) {
                    require((assetWeights[i] >= 0) || (assetWeights[i] <= 100000), "Invalid asset target weight"); // 10만분율
                    assets[j].targetWeight = assetWeights[i];
                    found = true;
                    break;
                    }
                }
            require(found, "Asset not found");
        }
    }

    function updateOracleAddress(address[] memory assetAddresses, address[] memory assetOracles) public {
        for (uint i = 0; i < assetAddresses.length; i++) {
            bool found = false;
            for (uint j = 0; j < assets.length; j++) {
                if(assets[j].assetAddress == assetAddresses[i]) {
                    assets[j].oracleAddress = assetOracles[i];
                    found = true;
                    break;
                    }
                }
            require(found, "Asset not found");
        }
    }

    function updateFloatRatio(uint256 newFloatRatio) public {
        require((newFloatRatio >= 0) || (newFloatRatio <= 100000), "Invalid float ratio"); // 10만분율
        floatRatio = newFloatRatio;
    }

    function currentAssets() external view returns(AssetParams[] memory) {
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

    // strategy와 상호작용
    function depositIntoStrategy(address strategyAddress, uint256 assetAmount) external override {} 
    function redeemFromStrategy(address strategyAddress, uint256 assetAmount) external override {}

    // 보류
    function convertToShares(uint256 assetAmount) external view override returns(uint256 shareAmount) {}
    function convertToAssets(uint256 shareAmount) external view override returns (uint256 assetAmount){}
    function previewWithdraw(uint256 assetAmount) external view override returns (uint256){}
    function previewDeposit(uint256 assetAmount) external view override returns (uint256){}

}