// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IProduct.sol";
import "./IStrategy.sol";
import "./UsdPriceModule.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract Product is ERC20, IProduct {
    using Math for uint256;

    AssetParams[] public assets;
    StrategyParams[] public strategies;
    address[] withdrawalQueue;
    
    ///@notice All ratios use per 100000. 
    ///ex. 100000 = 100%, 10000 = 10%, 1000 = 1%, 100 = 0.1%
    uint256 private _floatRatio;

    bool private isActive;

    string private _dacName; 
    address private _dacAddress;
    uint256 private _sinceDate;

    UsdPriceModule private _usdPriceModule;

    event ActivateProduct(
        address indexed caller,
        uint256 time
    );

    event DeactivateProduct(
        address indexed caller,
        uint256 time
    );

    event UpdateWithdrawalQueue(
        address indexed caller, 
        address[] newWithdrawalQueue,
        uint256 time);

    ///@notice DAC means the owner of the product.
    ///Only dac member can call the rebalance method.
    modifier onlyDac {
        require(_msgSender()==_dacAddress);
        _;
    }
        
    constructor(
        string memory name_, 
        string memory symbol_, 
        address dacAddress_, 
        string memory dacName_, 
        address usdPriceModule_,
        address[] memory assetAddresses_, 
        uint256 floatRatio_
        ) 
        ERC20 (name_, symbol_)
    {
        
        _sinceDate = block.timestamp;
        isActive = false;

        require(dacAddress_ != address(0x0), "Invalid dac address");
        _dacAddress = dacAddress_;
        _dacName = dacName_;

        require(usdPriceModule_ != address(0x0), "Invalid USD price module address");
        _usdPriceModule = UsdPriceModule(usdPriceModule_);

        for (uint i=0; i<assetAddresses_.length; i++){
            require(assetAddresses_[i] != address(0x0), "Invalid underlying asset address");
            assets.push(AssetParams(assetAddresses_[i], 0, 0)); 
        }

        require((floatRatio_ >= 0) || (floatRatio_ <= 100000), "Invalid float ratio");
        _floatRatio = floatRatio_;
    }

    ///@notice Return current asset statistics.
    function currentAssets() external view override returns(AssetParams[] memory) {
        return assets;
    }

    function updateUsdPriceModule(address newUsdPriceModule) external onlyDac {
        _usdPriceModule = UsdPriceModule(newUsdPriceModule);
    }

    function addStrategy(address newStrategyAddress) external override onlyDac {
        require(newStrategyAddress!=address(0x0), "Invalid strategy address");
        strategies.push(StrategyParams(newStrategyAddress, IStrategy(newStrategyAddress).underlyingAsset()));
    }

    ///@notice Add one underlying asset to be handled by the product. 
    ///@dev It is recommended to call updateWeight method after calling this method.
    function addAsset(address newAssetAddress) external override {
        require(newAssetAddress!=address(0x0), "Invalid asset address");
        require(!checkAsset(newAssetAddress), "Asset Already Exists");
        assets.push(AssetParams(newAssetAddress, 0, 0)); 
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
    function checkAsset(address _assetAddress) public view override returns (bool) {
        for (uint i = 0; i < assets.length; i++) {
            if(assets[i].assetAddress == _assetAddress) {
                return true;
            }
        }
        return false;
    }

    function checkStrategy(address strategyAddress) public view override returns(bool) {
        for (uint i=0; i<strategies.length; i++){
            if(strategies[i].strategyAddress == strategyAddress) {
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
            totalValue += _usdPriceModule.getAssetUsdValue(assets[i].assetAddress, assetBalance(assets[i].assetAddress));
        }
        return totalValue;
    }

    ///@notice Calculates the total value of floats the product holds.
    function totalFloatValue() public view override returns (uint256) {
        uint256 totalValue = 0;
        for (uint256 i=0; i<assets.length; i++) {
            totalValue += _usdPriceModule.getAssetUsdValue(assets[i].assetAddress, assetFloatBalance(assets[i].assetAddress));
        }
        return totalValue;
    }

    ///@notice Calculates the value of specific underlying assets the product holds.
    function assetValue(address assetAddress) public view override returns (uint256) {
        uint totalValue = 0;
        for (uint256 i=0; i < assets.length; i++) {
            if(assets[i].assetAddress == assetAddress) {
                totalValue += _usdPriceModule.getAssetUsdValue(assets[i].assetAddress, assetBalance(assets[i].assetAddress));
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
                totalValue += _usdPriceModule.getAssetUsdValue(assets[i].assetAddress, assetFloatBalance(assets[i].assetAddress));
                break;
            }
        }
        return totalValue;
    }

    function checkActivation() public view returns(bool) {
        return isActive;
    }

    function activateProduct() external onlyDac {
        require(!isActive);
        
        require(assets.length != 0);
        require(withdrawalQueue.length != 0);
        require(strategies.length != 0);
        require(strategies.length == assets.length);

        uint sumOfWeights = 0;
        for(uint i=0; i<assets.length; i++) {
            sumOfWeights += assets[i].targetWeight;
        }
        require(sumOfWeights == 100000);

        isActive = true;

        emit ActivateProduct(_msgSender(), block.timestamp);
    }

    function deactivateProduct() external onlyDac {
        require(isActive);
        // deactivate 상태일 때 불가능한 것들 생각해보기 -> require문 날려야 함
        isActive = false;

        emit DeactivateProduct(_msgSender(), block.timestamp);
    }

    function updateWithdrawalQueue(address[] memory newWithdrawalQueue) external onlyDac {
        require(newWithdrawalQueue.length <= strategies.length, "Too many elements");

        for (uint i=0; i<newWithdrawalQueue.length; i++){
            require(checkStrategy(newWithdrawalQueue[i]), "Strategy doesn't exist");
        }

        withdrawalQueue = newWithdrawalQueue;

        emit UpdateWithdrawalQueue(_msgSender(), newWithdrawalQueue, block.timestamp);
    }

    function deposit(address assetAddress, uint256 assetAmount, address receiver) external returns (uint256 shares) {
        require(isActive, "Product is disabled now");
        require(checkAsset(assetAddress), "Asset not found");
        // deposit 양 maxDeposit이랑 비교 -> 100달러가 상한선

        // current price 가져오기
        // max deposit 계산 후 require

        // uint256 shares = previewDeposit(assets); // dollar 기준 가격으로 share 양 계산하기
        // require(shares > 0, "Vault: deposit less than minimum");

        // SafeERC20.safeTransferFrom(_asset, caller, address(this), assets);
        // safeERC20이랑 그냥 ERC20 차이점 분석 필요
        // _mint(receiver, shares);

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
            assets[i].currentPrice = _usdPriceModule.getAssetUsdPrice(assets[i].assetAddress);
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

    // 몇 달러 max로 deposit할 수 있는지 반환
    function maxDepositValue(address receiver) public pure returns (uint256){
        return 105 * 1e18;
    } // for deposit

    // 몇 달러 max로 withdraw할 수 있는지 반환
    function maxWithdrawValue(address owner) public view returns (uint256) {
        return sharesValue(balanceOf(owner));
    } // for withdraw

    function depositIntoStrategy(address strategyAddress, uint256 assetAmount) external override {
        // strategy 관련 작업 끝나면 logic 추가
        IStrategy(strategyAddress);
    } 

    function redeemFromStrategy(address strategyAddress, uint256 assetAmount) external override {
        // strategy 관련 작업 끝나면 logic 추가
        IStrategy(strategyAddress);
    }

    // asset amount 받고, 이에 맞는 share 개수 반환
    function convertToShares(address assetAddress, uint256 assetAmount) public view returns(uint256 shareAmount) {
        uint256 _assetValue = _usdPriceModule.getAssetUsdValue(assetAddress, assetAmount);
        return _valueToShares(_assetValue);
    }

    // share amount 받고, 이에 맞는 asset 개수 반환
    function convertToAssets(address assetAddress, uint256 shareAmount) public view returns(uint256 assetAmount) {
        uint256 _shareValue = sharesValue(shareAmount);
        return _valueToAssets(assetAddress, _shareValue);
    }
    
    // asset의 dollar 양 받고, share 토큰 개수 반환
    // 수식 : deposit asset value * total share supply / portfolio value
    function _valueToShares(uint256 _assetValue) internal view returns(uint256 shareAmount) {
        return (_assetValue * totalSupply()) / portfolioValue();
    } 

    // share의 dollar 양 받고, asset의 개수 반환
    // 수식 : withdraw share value / asset Price
    function _valueToAssets(address assetAddress, uint256 _shareValue) internal view returns(uint256 assetAmount) {
        return _shareValue / _usdPriceModule.getAssetUsdPrice(assetAddress);
    }

    // shareToken 1개의 가격 정보 반환
    function sharePrice() public view returns(uint256) {
        return portfolioValue() * 1e18 / totalSupply();
    }

    // share Token 여러개의 가격 정보 반환
    function sharesValue(uint256 shareAmount) public view returns(uint256) {
        return (portfolioValue() * shareAmount) / totalSupply();
    }
}