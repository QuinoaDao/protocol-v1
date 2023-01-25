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
    uint256 floatRatio;

    string private _dacName; // DB가 없어서 contract에서도 필요한 듯
    address private _dacAddress; // 애초에 필요
    uint256 private _sinceDate;

    // struct AssetParams {
    //     address assetAddress;
    //     address oracleAddress; // for chainlink price feed
    //     uint256 targetWeight; // TODO type 조정 필요, 소숫점 관리 어떻게 할지 논의 필요. if targetWeight 25 => 이후 로직에서 100으로 항상 나눠줘야 함.
    //     uint256 currentPrice; // when rebalancing -> update
    // }

    // struct StrategyParams {
    //     address strategyAddress;
    //     address assetAddress;
    //     uint256 assetBalance;
    // }

    modifier onlyDac{
        require(_msgSender()==_dacAddress);
        _;
    }
        
    constructor(
        string memory name_, 
        string memory symbol_, 
        string memory dacName_, 
        address dacAddress_, 
        AssetParams[] memory assets_
        ) 
        ERC20(name_, symbol_)
    {
        _dacName = dacName_;
        _dacAddress = dacAddress_;
        _sinceDate = block.timestamp;
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

    // total values of tokens in float
    function totalFloat() public view returns(uint256) {
        uint256 totalValue = 0;
        for (uint256 i=0; i < assets.length; i++) {
            // (민균) 이 balanceOfAsset 지금 우멘이 float + strategy asset 으로 바꿔놨음 -> 그럼 여기서 float을 계산하지 않고 있는거 아닌가 ??
            // 무슨 의도의 코드인지 잘 모르겠넹 float이 내가 생각햇던거랑 다른가 ?!
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

    // (민균) 이게 전체 float + strategy 인듯 ? (dollar 기준)
    function getPortfolioValue() public view returns (uint256) {
        // TODO calculate total values of assets in this product
        // get values from strategies and add it to the float
        uint256 portfolioValue = 0;
        for (uint256 i=0; i < assets.length; i++) {
            portfolioValue += getAssetValue(assets[i].assetAddress);
        }
        return portfolioValue;
    }

    // (민균) asset 1개 당 float + strategy (dollar 기준)
    function getAssetValue(address assetAddress) public view returns (uint256) {
        require(checkAsset(assetAddress), "Asset Doesn't Exist");

        // TODO get asset values of each asset
        // considering float and assets in strategy
        // 1. get asset amount from strategies related
            // TODO StrategyParams에서 가져오는지 또는 strategies의 totalAsset() 불러오는지 결정 필요. 만약 전자라면 언제 Param 업데이트 해아하는지 결정 필요.
        // 2. add it the float amount of that token
        // uint256 floatAmount = balanceOfAsset(assetAddress);
        // 3. get values by multiplying the asset price
    }

    /// @notice Token Amount of float token corresponding to param. 
    // TODO float이 아닌 float + Strategy 내에 있는 token합으로 바꿔야 할듯.
    function balanceOfAsset(address assetAddress) public view returns (uint256) {
        require(checkAsset(assetAddress), "Asset Doesn't Exist");
        // uint256 strategyAsset
        uint256 totalAsset = IERC20(assetAddress).balanceOf(address(this));
        for (uint i = 0; i < strategies.length; i++) {
            if(strategies[i].assetAddress == assetAddress) {
                totalAsset += IStrategy(strategies[i].strategyAddress).totalAssets();
            }
        }
        return totalAsset;
        // return IERC20(assetAddress).balanceOf(address(this)) + strategyAsset;
    }

    // TODO addAsset 이후에 updateWeight호출 필요해보임 -> 관리 이슈 논의 필요
    function addAsset(address newAssetAddress, address newOracleAddress) external {
        require(!checkAsset(newAssetAddress), "Asset Already Exists");
        assets.push(AssetParams(newAssetAddress, newOracleAddress, 0, 0)); // TODO default target weight, default currentPrice
    }

    function updateWeight(AssetParams[] memory newParams) public {
        for (uint i = 0; i < newParams.length; i++) {
            bool found = false;
            for (uint j = 0; j < assets.length; j++) {
                if(assets[j].assetAddress == newParams[i].assetAddress) {
                    assets[j] = newParams[i]; // (민균) current price에 혼동이 오려나 ? 그냥 weight만 update하는 방식으로 바꿔야 하나 싶음
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
                // float으로 충분할 경우 // (민균) 지금 currentBalance가 float에 대한 양이 아니지 않나요 ?.. float + strategy 인뎅
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

    // function totalSupply() external view returns (uint256); // erc20 function
    // function balanceOf(address owner) external view returns (uint256); // erc20 function


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