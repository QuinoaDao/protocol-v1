// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./IProduct.sol";
import "./IStrategy.sol";
import "./IUsdPriceModule.sol";
import "./SwapModule.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error DuplicatedValue(); 
error ZeroAddress(); 
error NotFound(); 
error OutOfRange();
error DisabledNow(bool status); 
error ErrorWithMsg(string message);

interface IWhiteListRegistry {
    function checkWhitelist(address product, address user) external view returns(bool);
}

interface IStrategyForEmergency {
    function withdrawAllToProduct() external returns(bool);
}

contract Product is ERC20, IProduct, SwapModule, AutomationCompatibleInterface {
    using Math for uint256;

    AssetParams[] public assets;
    mapping (address => address) public strategies; // asset address => strategy address
    address[] public withdrawalQueue;
    uint256 lastRebalanced;

    ///@notice All ratios use per 100000. 
    ///ex. 100000 = 100%, 10000 = 10%, 1000 = 1%, 100 = 0.1%
    uint256 private _floatRatio;
    uint256 private _deviationThreshold;
    address public _underlyingAssetAddress;

    bool private isActive;

    ///@dev DAC means the owner of the product.
    string private _dacName; 
    address private _dacAddress;
    uint256 private _sinceDate;
    
    address private _keeperRegistry;
    uint256 private _rebalanceInterval;

    IUsdPriceModule private _usdPriceModule;
    IWhiteListRegistry private _whitelistRegistry;

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

    event EmergencyWithdraw(
        address indexed caller,
        address indexed dac,
        uint256 portfolioValue,
        uint256 time
    );

    modifier onlyDac {
        require(_msgSender()==_dacAddress, "Only dac can access"); 
        _;
    }

    modifier onlyWhitelist {
        require((_whitelistRegistry.checkWhitelist(address(this), _msgSender())) || ( _msgSender()==_dacAddress), "You're not in whitelist"); 
        _;
    }
        
    constructor(
        ProductInfo memory productInfo_,
        address whitelistRegistry_,
        address keeperRegistry_, 
        address usdPriceModule_, 
        address[] memory assetAddresses_, 
        address swapFactory_, 
        address swapRouter_ 
        ) 
        ERC20 (productInfo_.productName, productInfo_.productSymbol)
    {
        
        _sinceDate = block.timestamp;
        isActive = false;

        if(productInfo_.dacAddress == address(0x0)) _dacAddress = _msgSender();
        else _dacAddress = productInfo_.dacAddress;
        _dacName = productInfo_.dacName;

        if(productInfo_.underlyingAssetAddress == address(0x0)) revert ZeroAddress();
        _underlyingAssetAddress = productInfo_.underlyingAssetAddress;
        assets.push(AssetParams(_underlyingAssetAddress, 0, 0));

        if(whitelistRegistry_ == address(0x0)) revert ZeroAddress();
        _whitelistRegistry = IWhiteListRegistry(whitelistRegistry_);
        
        if(usdPriceModule_ == address(0x0)) revert ZeroAddress();
        _usdPriceModule = IUsdPriceModule(usdPriceModule_);

        if(keeperRegistry_ == address(0x0)) revert ZeroAddress();
        _keeperRegistry = keeperRegistry_;

        for (uint i=0; i<assetAddresses_.length; i++){
            if(assetAddresses_[i] == address(0x0)) revert ZeroAddress();
            if(_underlyingAssetAddress == assetAddresses_[i]) {
                continue;
            }
            assets.push(AssetParams(assetAddresses_[i], 0, 0)); 
        }

        if((productInfo_.floatRatio < 0) || (productInfo_.floatRatio > 100000)) revert OutOfRange();
        _floatRatio = productInfo_.floatRatio;
        
        if((productInfo_.deviationThreshold < 0) || (productInfo_.deviationThreshold > 10000)) revert OutOfRange();
        _deviationThreshold = productInfo_.deviationThreshold;

        if(swapFactory_ == address(0x0)) revert ZeroAddress();
        swapFactory = swapFactory_;
        if(swapRouter_ == address(0x0)) revert ZeroAddress();
        swapRouter = IUniswapV2Router02(swapRouter_);

        _rebalanceInterval = 1 days; 
    }

    function currentStrategies() public view override returns(address[] memory) {
        address[] memory tempStrategyAddresses = new address[](assets.length);
        uint cnt = 0;

        for (uint i=0; i<assets.length; i++){
            if(strategies[assets[i].assetAddress] != address(0x0)) {
                tempStrategyAddresses[cnt] = strategies[assets[i].assetAddress];
                cnt += 1;
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
    function currentAssets() public view override returns(AssetParams[] memory) {
        return assets;
    }

    ///@notice Add one underlying asset to be handled by the product. 
    ///@dev It is recommended to call updateWeight method after calling this method.
    function addAsset(address newAssetAddress) external onlyDac {
        if(newAssetAddress == address(0x0)) revert ZeroAddress();
        if(checkAsset(newAssetAddress)) revert DuplicatedValue();
        assets.push(AssetParams(newAssetAddress, 0, 0)); 
    }

    function addStrategy(address strategyAddress) external onlyDac {
        if(!checkAsset(IStrategy(strategyAddress).underlyingAsset())) revert NotFound();
        if(strategyAddress == address(0x0)) revert ZeroAddress();
        if(strategies[IStrategy(strategyAddress).underlyingAsset()] != address(0x0)) revert DuplicatedValue();
        if(IStrategy(strategyAddress).dacAddress() != _dacAddress) revert ErrorWithMsg("strategyDacConflict");
        strategies[IStrategy(strategyAddress).underlyingAsset()] = strategyAddress;
    }

    ///@notice update target weights and it will be used as a reference weight at the next rebalancing.
    function updateWeight(address[] memory assetAddresses, uint256[] memory assetWeights) external onlyDac {
        if(assetAddresses.length != assetWeights.length) revert ErrorWithMsg("pairConflict");

        uint256 sumOfWeight = 0;
        for (uint i = 0; i < assetAddresses.length; i++) {
            bool found = false;
            for (uint j = 0; j < assets.length; j++) {
                if(assets[j].assetAddress == assetAddresses[i]) {
                    if((assetWeights[i] < 0) || (assetWeights[i] > 100000)) revert OutOfRange();
                    assets[j].targetWeight = assetWeights[i];
                    sumOfWeight += assetWeights[i];
                    found = true;
                    break;
                }
            }
            if(!found) revert NotFound();
        }
        if(sumOfWeight != 100000) revert OutOfRange();
    }

    function updateUsdPriceModule(address newUsdPriceModule) external onlyDac {
        if(newUsdPriceModule == address(0x0)) revert ZeroAddress();
        if(newUsdPriceModule == address(_usdPriceModule)) revert DuplicatedValue();
        _usdPriceModule = IUsdPriceModule(newUsdPriceModule);
    }

    function updateSwapModuleRouter(address newSwapModuleRouter) external onlyDac {
        if(newSwapModuleRouter == address(0x0)) revert ZeroAddress();
        if(newSwapModuleRouter == address(_usdPriceModule)) revert DuplicatedValue();
        swapRouter = IUniswapV2Router02(newSwapModuleRouter);
    }

    function updateSwapModuleFactory(address newSwapModuleFactory) external onlyDac {
        if(newSwapModuleFactory == address(0x0)) revert ZeroAddress();
        if(newSwapModuleFactory == address(_usdPriceModule)) revert DuplicatedValue();
        swapFactory = newSwapModuleFactory;
    }

    function updateWhitelistRegistry(address newWhitelistRegistry) external onlyDac {
        if(newWhitelistRegistry == address(0x0)) revert ZeroAddress();
        if(newWhitelistRegistry == address(_whitelistRegistry)) revert DuplicatedValue();
        _whitelistRegistry = IWhiteListRegistry(newWhitelistRegistry);
    }

    function updateKeeperRegistryAddress(address newKeeperRegistry_) external onlyDac {
        if(newKeeperRegistry_ == address(0x0)) revert ZeroAddress();
        if(newKeeperRegistry_ == _keeperRegistry) revert DuplicatedValue();
        _keeperRegistry = newKeeperRegistry_;
    }

    ///@notice Update target float ratio. It will reflect at the next rebalancing or withdrawal.
    function updateFloatRatio(uint256 newFloatRatio) external onlyDac {
        if(newFloatRatio == _floatRatio) revert DuplicatedValue();
        if((newFloatRatio < 0) || (newFloatRatio > 100000)) revert OutOfRange();
        _floatRatio = newFloatRatio;
    }

    ///@notice Update rebalance threshold. It will reflect at the next rebalancing or withdrawal.
    function updateDeviationThreshold(uint256 newDeviationThreshold) external onlyDac {
        if(newDeviationThreshold == _deviationThreshold) revert DuplicatedValue();
        if((newDeviationThreshold < 0) || (newDeviationThreshold > 100000)) revert OutOfRange();
        _deviationThreshold = newDeviationThreshold;
    }

    ///@notice Returns decimals of the product share token.
    function decimals() public pure override(ERC20, IERC20Metadata) returns (uint8) {
        return 18;
    } 

    ///@notice Returns dac name.
    function dacName() public view override returns(string memory) {
        return _dacName;
    }

    ///@notice Returns dac address(typically equal to product deployer).
    function dacAddress() public view override returns(address) {
        return _dacAddress;
    }

    ///@notice Returns the date when the product was deployed in Unix timestamp format.
    function sinceDate() public view override returns(uint256) {
        return _sinceDate;
    }

    function currentUsdPriceModule() public view returns(address) {
        return address(_usdPriceModule);
    }

    ///@notice Returns current target float ratio.
    function currentFloatRatio() public view override returns(uint256) {
        return _floatRatio;
    }

    function currentDeviationThreshold() public view returns(uint256) {
        return _deviationThreshold;
    }

    ///@notice Check if the asset address is the asset currently being handled in the product.
    function checkAsset(address _assetAddress) public view returns (bool) {
        for (uint i = 0; i < assets.length; i++) {
            if(assets[i].assetAddress == _assetAddress) {
                return true;
            }
        }
        return false;
    }

    function checkStrategy(address strategyAddress) public view returns(bool) {
        for (uint i=0; i<assets.length; i++){
            if(strategies[assets[i].assetAddress] == strategyAddress) {
                return true;
            }
        }
        return false;
    }

    ///@notice Returns the float amount for one of the underlying assets of the product.
    function assetFloatBalance(address assetAddress) public view returns(uint256) {
        if(!checkAsset(assetAddress)) revert NotFound();
        return _assetBalanceOf(assetAddress, address(this));
    }

    function _assetBalanceOf(address _assetAddress, address _caller) internal view returns(uint256) {
        return IERC20(_assetAddress).balanceOf(_caller);
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
    function totalFloatValue() public view returns (uint256) {
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
    function assetFloatValue(address assetAddress) public view returns(uint256) {
        uint totalValue = 0;
        for (uint256 i=0; i < assets.length; i++) {
            if(assets[i].assetAddress == assetAddress) {
                totalValue += _usdPriceModule.getAssetUsdValue(assets[i].assetAddress, assetFloatBalance(assets[i].assetAddress));
                break;
            }
        }
        return totalValue;
    }

    function checkActivation() public view override returns(bool) {
        return isActive;
    }

    function activateProduct() external onlyDac {
        if(isActive) revert DisabledNow(isActive);
        
        if(assets.length == 0) revert NotFound();

        uint sumOfWeights = 0;
        for(uint i=0; i<assets.length; i++) {
            sumOfWeights += assets[i].targetWeight;
            if(assets[i].targetWeight > 0) {
                if(strategies[assets[i].assetAddress] == address(0)) revert NotFound();
            }
        }
        if(sumOfWeights != 100000) revert OutOfRange();
        if(withdrawalQueue.length == 0) revert ErrorWithMsg("noWithdrawalQueue");
        if(shareValue(balanceOf(_dacAddress)) < (200 * 1e18)) revert ErrorWithMsg("TooLowDacDepositValue");

        isActive = true;

        emit ActivateProduct(_msgSender(), block.timestamp);
    }

    function deactivateProduct() public onlyDac {
        if(!isActive) revert DisabledNow(isActive);

        isActive = false;

        emit DeactivateProduct(_msgSender(), block.timestamp);
    }

    function updateWithdrawalQueue(address[] memory newWithdrawalQueue) external onlyDac {
        if(newWithdrawalQueue.length > assets.length) revert ErrorWithMsg("TooManyElements");

        for (uint i=0; i<newWithdrawalQueue.length; i++){
            if(!checkStrategy(newWithdrawalQueue[i])) revert NotFound();
        }

        withdrawalQueue = newWithdrawalQueue;

        emit UpdateWithdrawalQueue(_msgSender(), newWithdrawalQueue, block.timestamp);
    }

    function deposit(address assetAddress, uint256 assetAmount, address receiver) external override onlyWhitelist returns (uint256) {
        // Dac cannot deposit when product is in deactivation state
        require((_msgSender() == _dacAddress) || isActive, "Deposit is disabled now");
        require(checkAsset(assetAddress), "Asset not found");

        // Users can deposit only under $55
        uint256 depositValue = _usdPriceModule.getAssetUsdValue(assetAddress, assetAmount);
        require(depositValue < maxDepositValue(_msgSender()), "Too much deposit");

        uint256 shareAmount = _valueToShares(depositValue);
        uint256 depositSharePrice = sharePrice();
        require(shareAmount > 0, "short of deposit");

        SafeERC20.safeTransferFrom(IERC20(assetAddress), _msgSender(), address(this), assetAmount);

        _mint(receiver, shareAmount);

        emit Deposit(_msgSender(), receiver, assetAmount, shareAmount, depositSharePrice, block.timestamp);
        return shareAmount;
    }

    function emergencyWithdraw() external onlyDac {
        if(isActive) deactivateProduct();

        for(uint i=0; i<assets.length; i++){
            if(strategies[assets[i].assetAddress] != address(0x0)) { 
                if(IStrategy(strategies[assets[i].assetAddress]).totalAssets() > 0) { 
                   require(IStrategyForEmergency(strategies[assets[i].assetAddress]).withdrawAllToProduct());
                }
            }
            SafeERC20.safeTransfer(IERC20(assets[i].assetAddress), _dacAddress, _assetBalanceOf(assets[i].assetAddress, address(this)));
        }

        emit EmergencyWithdraw(_msgSender(), _dacAddress, portfolioValue(), block.timestamp);
    }

    function withdraw(address assetAddress, uint256 shareAmount, address receiver, address owner) external override returns (uint256) {
        require((_msgSender() != _dacAddress) || !isActive, "Withdrawal is disabled now");
        require(checkAsset(assetAddress), "Asset not found");

        if(shareAmount == type(uint256).max) {
            shareAmount = balanceOf(owner);
        }
        require(shareAmount <= balanceOf(owner), "Too much withdrawal");

        uint256 withdrawalAmount = _valueToAssets(assetAddress, shareValue(shareAmount));
        require(withdrawalAmount > 0, "short of withdrawal");

        // Note
        // If the product cannot afford the user's withdrawal amount from the float of the token that user wants to withdraw, 
        // it should withdraw tokens from the another token float or strategy to cover it.
        if (_assetBalanceOf(assetAddress, address(this)) < withdrawalAmount) {

            for (uint i=0; i<assets.length; i++){ // Withdraw tokens from the another float
                address floatAssetAddress = assets[i].assetAddress;
                
                if(floatAssetAddress == assetAddress) {
                    continue;
                }

                uint256 floatAmount= _assetBalanceOf(assetAddress, address(this));
                if(floatAmount >= withdrawalAmount) { // Withdrawing is done
                    break;
                }

                uint256 needAmount = Math.min(_estimateSwapInputAmount(withdrawalAmount - floatAmount, floatAssetAddress, assetAddress), _assetBalanceOf(floatAssetAddress, address(this)));
                if(_estimateSwapOutputAmount(needAmount, floatAssetAddress, assetAddress) == 0) { // There is no float
                    continue;
                }

                IERC20(floatAssetAddress).approve(address(swapRouter), needAmount);

                if(needAmount == _assetBalanceOf(floatAssetAddress, address(this))) {
                    _swapExactInput(needAmount, floatAssetAddress, assetAddress, address(this));
                }
                else {
                    _swapExactOutput(withdrawalAmount - floatAmount, floatAssetAddress, assetAddress, address(this));
                }
            }

            for (uint i=0; i<withdrawalQueue.length; i++){ // Withdraw tokens from the strategy
                uint256 floatAmount = _assetBalanceOf(assetAddress, address(this));
                if(floatAmount >= withdrawalAmount) { // Withdrawing is done
                    break;
                }

                address strategyAssetAddress = IStrategy(withdrawalQueue[i]).underlyingAsset();

                if(assetAddress == strategyAssetAddress) {
                    uint256 needAmount = Math.min(withdrawalAmount - floatAmount, IStrategy(withdrawalQueue[i]).totalAssets());

                    if(needAmount == 0) {
                        continue;
                    }
                    
                    _redeemFromStrategy(withdrawalQueue[i], needAmount);
                }
                else { 
                    uint256 needAmount = Math.min(_estimateSwapInputAmount(withdrawalAmount - floatAmount, strategyAssetAddress, assetAddress), IStrategy(withdrawalQueue[i]).totalAssets());
                    if(_estimateSwapOutputAmount(needAmount, strategyAssetAddress, assetAddress) == 0) {
                        continue;
                    }

                    _redeemFromStrategy(withdrawalQueue[i], needAmount);
                    IERC20(strategyAssetAddress).approve(address(swapRouter), needAmount);

                    if(needAmount == _estimateSwapInputAmount(withdrawalAmount - floatAmount, strategyAssetAddress, assetAddress)) {
                        _swapExactOutput(withdrawalAmount - floatAmount, strategyAssetAddress, assetAddress, address(this));

                    }
                    else {
                        _swapExactInput(needAmount, strategyAssetAddress, assetAddress, address(this));
                    }
                }
            }

            // Note
            // If we withdraw as much as possible, but it is still less than the amount the user wants. 
            // Then the amount that can be withdrawn is forcibly adjusted.
            if(withdrawalAmount>IERC20(assetAddress).balanceOf(address(this))) {
                withdrawalAmount = IERC20(assetAddress).balanceOf(address(this));
                shareAmount = convertToShares(assetAddress, withdrawalAmount);
            }
        }
        
        uint256 withdrawalSharePrice = sharePrice();

        if(_msgSender() != owner) {
            _spendAllowance(owner, _msgSender(), shareAmount);
        }

        _burn(owner, shareAmount);
        SafeERC20.safeTransfer(IERC20(assetAddress), receiver, withdrawalAmount);
        emit Withdraw(msg.sender, receiver, owner, withdrawalAmount, shareAmount, withdrawalSharePrice, block.timestamp);

        return shareAmount;
    }

    function rebalance() public override {
        require(_msgSender() == _dacAddress || _msgSender() == _keeperRegistry, "Access Not allowed");
        require(isActive, "Product is disabled now");

        uint256 currentPortfolioValue = 0;
        for (uint i = 0; i < assets.length; i++) {
            assets[i].currentPrice = _usdPriceModule.getAssetUsdPrice(assets[i].assetAddress);
            currentPortfolioValue += assetValue(assets[i].assetAddress); 
        }

        for(uint i=0; i < assets.length; i++){
            if(assets[i].assetAddress == _underlyingAssetAddress) { 
                continue;
            }
            
            uint256 targetBalance = _usdPriceModule.convertAssetBalance(assets[i].assetAddress, ((assets[i].targetWeight * currentPortfolioValue) / 100000)); 
            uint256 currentBalance = assetBalance(assets[i].assetAddress); 

            if (currentBalance > targetBalance*(100000 + _deviationThreshold)/100000) {
                uint256 sellAmount = currentBalance - targetBalance;

                require(_redeemFromStrategy(strategies[assets[i].assetAddress], Math.min(sellAmount, IStrategy(strategies[assets[i].assetAddress]).totalAssets())), "Redeem Failed");

                IERC20(assets[i].assetAddress).approve(address(swapRouter), sellAmount);
                _swapExactInput(sellAmount, assets[i].assetAddress, _underlyingAssetAddress, address(this));
            }
        }

        for(uint i=0; i < assets.length; i++) {
            if(assets[i].assetAddress == _underlyingAssetAddress) {
                continue;
            }
            
            uint256 targetBalance = _usdPriceModule.convertAssetBalance(assets[i].assetAddress, ((assets[i].targetWeight * currentPortfolioValue) / 100000)); 
            uint256 currentBalance = assetBalance(assets[i].assetAddress);
            IStrategy assetStrategy = IStrategy(strategies[assets[i].assetAddress]);

            if (currentBalance < targetBalance*(100000 - _deviationThreshold) / 100000) {
                uint256 buyAmount = targetBalance - currentBalance;
                uint256 amountInEstimated = _estimateSwapInputAmount(buyAmount, _underlyingAssetAddress, assets[i].assetAddress);

                IERC20(_underlyingAssetAddress).approve(address(swapRouter), amountInEstimated);
                _swapExactOutput(buyAmount, _underlyingAssetAddress, assets[i].assetAddress, address(this));
            }
            uint256 newFloatBalance = assetFloatBalance(assets[i].assetAddress);
            if(newFloatBalance > targetBalance*_floatRatio / 100000){
                require(_depositIntoStrategy(address(assetStrategy), newFloatBalance - targetBalance*_floatRatio/100000), "Deposit into Strategy Failed");
            }
        }
        
        lastRebalanced = block.timestamp;
        emit Rebalance(address(this), assets, block.timestamp);
    }

    function checkValidAllocation() internal returns(bool) {
        uint256 curretPortfolioValue = 0;
        for (uint i = 0; i < assets.length; i++) {
            assets[i].currentPrice = _usdPriceModule.getAssetUsdPrice(assets[i].assetAddress);
            curretPortfolioValue += assetValue(assets[i].assetAddress); // stratey + float value
        }
        for (uint i=0; i < assets.length; i++) {
            uint256 targetBalance = ((assets[i].targetWeight * curretPortfolioValue) / 100000) / assets[i].currentPrice;
            uint256 currentBalance = assetBalance(assets[i].assetAddress); // current asset balance
            if (currentBalance > targetBalance*(100000 + _deviationThreshold)/100000 || currentBalance < targetBalance*(100000 - _deviationThreshold)/100000) {
                return false;
            }
        }
        return true;
    }

    function checkUpkeep(bytes calldata checkData) external returns (bool upkeepNeeded, bytes memory performData) {
        upkeepNeeded = (!checkValidAllocation() || (lastRebalanced + _rebalanceInterval < block.timestamp));
        return(upkeepNeeded, bytes(""));
    }

    function performUpkeep(bytes calldata performData) external {
        // call rebalance
        rebalance();
    }

    function maxDepositValue(address receiver) public view override returns (uint256){
        if(receiver == _dacAddress) return type(uint256).max;
        else return 55 * 1e18;
    }

    function maxWithdrawValue(address owner) public view override returns (uint256) {
        return shareValue(balanceOf(owner));
    } 

    function _depositIntoStrategy(address strategyAddress, uint256 assetAmount) private returns(bool){
        if(!isActive) revert DisabledNow(isActive);
        address assetAddress = IStrategy(strategyAddress).underlyingAsset();
        SafeERC20.safeTransfer(IERC20(assetAddress), strategyAddress, assetAmount); // token, to, value
        return true;
    } 

    function _redeemFromStrategy(address strategyAddress, uint256 assetAmount) private returns(bool){
        return IStrategy(strategyAddress).withdrawToProduct(assetAmount);
    }

    function convertToShares(address assetAddress, uint256 assetAmount) public view override returns(uint256 shareAmount) {
        uint256 _assetValue = _usdPriceModule.getAssetUsdValue(assetAddress, assetAmount);
        return _valueToShares(_assetValue);
    }

    function convertToAssets(address assetAddress, uint256 shareAmount) public view override returns(uint256 assetAmount) {
        uint256 _shareValue = shareValue(shareAmount);
        return _valueToAssets(assetAddress, _shareValue);
    }
    
    function _valueToShares(uint256 _assetValue) internal view returns(uint256 shareAmount) {
        return totalSupply() > 0 ? (_assetValue * totalSupply()) / portfolioValue() : _assetValue;
    } 

    function _valueToAssets(address _assetAddress, uint256 _shareValue) internal view returns(uint256 assetAmount) {
        return _usdPriceModule.convertAssetBalance(_assetAddress, _shareValue);
    }

    function sharePrice() public view override returns(uint256) {
        return totalSupply() > 0 ? portfolioValue() * 1e18 / totalSupply() : 10**decimals();
    }

    function shareValue(uint256 shareAmount) public view override returns(uint256) {
        return totalSupply() > 0 ? (portfolioValue() * shareAmount) / totalSupply() : shareAmount;
    }
}