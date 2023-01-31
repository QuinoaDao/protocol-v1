// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./IProduct.sol";
import "./IStrategy.sol";
import "./UsdPriceModule.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract Product is ERC20, IProduct {
    using Math for uint256;

    AssetParams[] public assets;
    mapping (address => address) strategies; // asset address => strategy address
    address[] withdrawalQueue;
    
    ///@notice All ratios use per 100000. 
    ///ex. 100000 = 100%, 10000 = 10%, 1000 = 1%, 100 = 0.1%
    uint256 private _floatRatio;
    uint256 private _deviationThreshold;

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
        uint256 time
    );

    ///@dev DAC means the owner of the product.
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
        uint256 floatRatio_,
        uint256 deviationThreshold_
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
        
        require((deviationThreshold_ >= 0) || (deviationThreshold_ <= 10000), "Invalid Rebalance Threshold");
        _deviationThreshold = deviationThreshold_;
    }

    function currentStrategies() external view returns(address[] memory) {
        address[] memory tempStrategyAddresses = new address[](assets.length);
        uint cnt = 0;

        for (uint i=0; i<assets.length; i++){
            if(strategies[assets[i].assetAddress] != address(0x0)) {
                tempStrategyAddresses[cnt] = strategies[assets[i].assetAddress];
            }
        }

        if(assets.length == cnt) {
            return tempStrategyAddresses;
        }
        else {
            address[] memory strategyAddresses = new address[](cnt);
            for (uint i=0; i<cnt; i++) {
                strategyAddresses[i] = tempStrategyAddresses[cnt];
            }
            return strategyAddresses;
        }
    }

    ///@notice Return current asset statistics.
    function currentAssets() external view override returns(AssetParams[] memory) {
        return assets;
    }

    function updateUsdPriceModule(address newUsdPriceModule) external onlyDac {
        _usdPriceModule = UsdPriceModule(newUsdPriceModule);
    }

    ///@notice Add one underlying asset to be handled by the product. 
    ///@dev It is recommended to call updateWeight method after calling this method.
    function addAsset(address newAssetAddress) external override {
        require(newAssetAddress!=address(0x0), "Invalid asset address");
        require(!checkAsset(newAssetAddress), "Asset Already Exists");
        assets.push(AssetParams(newAssetAddress, 0, 0)); 
    }

    function addStrategy(address assetAddress, address strategyAddress) external {
        require(checkAsset(assetAddress), "Asset Doesn't Exist");
        require(strategyAddress!=address(0x0), "Invalid Strategy address");
        strategies[assetAddress] = strategyAddress;
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

    ///@notice Update rebalance threshold. It will reflect at the next rebalancing or withdrawal.
    function updateDeviationThreshold(uint256 newDeviationThreshold) external override onlyDac {
        require((newDeviationThreshold >= 0) || (newDeviationThreshold <= 10000), "Invalid Rebalance Threshold");
        _deviationThreshold = newDeviationThreshold;
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
        for (uint i=0; i<assets.length; i++){
            if(strategies[assets[i].assetAddress] == strategyAddress) {
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
        IStrategy assetStrategy = IStrategy(strategies[assetAddress]);
        totalBalance += assetStrategy.totalAssets();
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

        uint sumOfWeights = 0;
        for(uint i=0; i<assets.length; i++) {
            sumOfWeights += assets[i].targetWeight;
            if(assets[i].targetWeight > 0) {
                require(strategies[assets[i].assetAddress] != address(0));
            }
        }
        require(sumOfWeights == 100000);

        // dac이 일정 금액 이상 deposit하고 있어야 함
        // 1인당 50달러 * 4명
        require(balanceOf(_dacAddress) > (200 * 1e18));

        isActive = true;

        emit ActivateProduct(_msgSender(), block.timestamp);
    }

    function deactivateProduct() external onlyDac {
        require(isActive);
        // deactivate 상태일 때 불가능한 것들 생각해보기 -> require문 
        isActive = false;

        emit DeactivateProduct(_msgSender(), block.timestamp);
    }

    function updateWithdrawalQueue(address[] memory newWithdrawalQueue) external onlyDac {
        require(newWithdrawalQueue.length <= assets.length, "Too many elements");

        for (uint i=0; i<newWithdrawalQueue.length; i++){
            require(checkStrategy(newWithdrawalQueue[i]), "Strategy doesn't exist");
        }

        withdrawalQueue = newWithdrawalQueue;

        emit UpdateWithdrawalQueue(_msgSender(), newWithdrawalQueue, block.timestamp);
    }

    function deposit(address assetAddress, uint256 assetAmount, address receiver) external returns (uint256) {
        // dac은 deactive한 상태에도 넣을 수 있음
        // deactive임 + dac이 아님 -> deposit 불가능
        require((_msgSender() == _dacAddress) || isActive, "Product is disabled now");
        require(checkAsset(assetAddress), "Asset not found");
        // deposit 양 maxDeposit이랑 비교 -> 50(55)달러가 상한선
        // max deposit 계산 후 require
        uint256 depositValue = _usdPriceModule.getAssetUsdValue(assetAddress, assetAmount);
        require(depositValue < maxDepositValue(_msgSender()), "Too much deposit");

        // dollar 기준 가격으로 share 양 계산하기
        uint256 shares = _valueToShares(depositValue);
        require(shares > 0, "short of deposit");

        SafeERC20.safeTransfer(IERC20(assetAddress), address(this), assetAmount); // token, to, value
        _mint(receiver, shares);

        emit Deposit(_msgSender(), receiver, assetAmount, shares);
        return shares;
    }

    function withdraw(address assetAddress, uint256 assetAmount, address receiver, address owner) external returns (uint256 shares) {
        require(checkAsset(assetAddress), "Asset not found");
        // Todo dac은 중간에 자신의 금액을 출금할 수 없음
        
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
        require(isActive, "Product is disabled now");
        
        uint256 curretPortfolioValue = 0;
        for (uint i = 0; i < assets.length; i++) {
            assets[i].currentPrice = _usdPriceModule.getAssetUsdPrice(assets[i].assetAddress);
            curretPortfolioValue += assetValue(assets[i].assetAddress); // stratey + float value
        }


        // SELL
        for(uint i=0; i < assets.length; i++){
            uint256 targetBalance = ((assets[i].targetWeight / 100000) * curretPortfolioValue) / assets[i].currentPrice;
            uint256 currentBalance = assetBalance(assets[i].assetAddress); // current asset balance
            if (currentBalance > targetBalance*(1 + _deviationThreshold / 100000)) {
                uint256 sellAmount = currentBalance - targetBalance;
                _redeemFromStrategy(strategies[assets[i].assetAddress], sellAmount);
                
                // swap to underlying stablecoin
                
            }
        }

        // BUY
        for(uint i=0; i < assets.length; i++) {
            uint256 targetBalance = ((assets[i].targetWeight / 100000) * curretPortfolioValue) / assets[i].currentPrice;
            uint256 currentBalance = assetBalance(assets[i].assetAddress); // current asset balance
            IStrategy assetStrategy = IStrategy(strategies[assets[i].assetAddress]);
            if (currentBalance < targetBalance*(1 - _deviationThreshold / 100000)) {
                uint256 buyAmount = targetBalance - currentBalance;

                // swap to underlying stablecoin
                
            }
            uint256 newFloatBalance = assetFloatBalance(assets[i].assetAddress);
            if(newFloatBalance > targetBalance*_floatRatio){
                _depositIntoStrategy(address(assetStrategy), newFloatBalance - targetBalance*_floatRatio);
            } 
        }
        
        // emit Rebalance(address(this), currentAssets(), block.timestamp);
    }

    // 몇 달러 max로 deposit할 수 있는지 반환
    function maxDepositValue(address receiver) public pure returns (uint256){
        return 55 * 1e18;
    } // for deposit

    // 몇 달러 max로 withdraw할 수 있는지 반환
    function maxWithdrawValue(address owner) public view returns (uint256) {
        return sharesValue(balanceOf(owner));
    } // for withdraw

    function _depositIntoStrategy(address strategyAddress, uint256 assetAmount) internal {
        address assetAddress = IStrategy(strategyAddress).underlyingAsset(); // 바로 transfer
        SafeERC20.safeTransfer(IERC20(assetAddress), strategyAddress, assetAmount); // token, to, value
    } 

    function _redeemFromStrategy(address strategyAddress, uint256 assetAmount) internal {
        IStrategy(strategyAddress).withdrawToVault(assetAmount);
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
    // vault가 비어있다면 1:1 반환
    function _valueToShares(uint256 _assetValue) internal view returns(uint256 shareAmount) {
        return totalSupply() > 0 ? (_assetValue * totalSupply()) / portfolioValue() : _assetValue;
    } 

    // share의 dollar 양 받고, asset의 개수 반환
    // 수식 : withdraw share value / asset Price
    // vault가 비어있다면 0 반환
    function _valueToAssets(address assetAddress, uint256 _shareValue) internal view returns(uint256 assetAmount) {
        return totalSupply() > 0 ? _shareValue / _usdPriceModule.getAssetUsdPrice(assetAddress) : 0;
    }

    // shareToken 1개의 가격 정보 반환
    // vault가 비어있다면 0 반환
    function sharePrice() public view returns(uint256) {
        return totalSupply() > 0 ? portfolioValue() * 1e18 / totalSupply() : 0;
    }

    // share Token 여러개의 가격 정보 반환
    // vault가 비어있다면 0 반환
    function sharesValue(uint256 shareAmount) public view returns(uint256) {
        return totalSupply() > 0 ? (portfolioValue() * shareAmount) / totalSupply() : 0;
    }
}