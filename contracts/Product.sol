// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./IProduct.sol";
import "./IStrategy.sol";
import "./UsdPriceModule.sol";
import "./ISwapModule.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./SwapModule.sol";

import "hardhat/console.sol";

contract Product is ERC20, IProduct, SwapModule {
    using Math for uint256;

    AssetParams[] public assets;
    mapping (address => address) public strategies; // asset address => strategy address
    address[] public withdrawalQueue;
    
    ///@notice All ratios use per 100000. 
    ///ex. 100000 = 100%, 10000 = 10%, 1000 = 1%, 100 = 0.1%
    uint256 private _floatRatio;
    uint256 private _deviationThreshold;
    address public _underlyingAssetAddress;

    bool private isActive;

    string private _dacName; 
    address private _dacAddress;
    uint256 private _sinceDate;

    UsdPriceModule private _usdPriceModule;
    //ISwapModule private _swapModule;

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
        require(_msgSender()==_dacAddress, "Only dac can access");
        _;
    }
        
    constructor(
        string memory name_, 
        string memory symbol_, 
        address dacAddress_, 
        string memory dacName_, 
        address usdPriceModule_,
        address underlyingAssetAddress_,
        address[] memory assetAddresses_, 
        uint256 floatRatio_,
        uint256 deviationThreshold_,
        address swapFactory_,
        address swapRouter_
        ) 
        ERC20 (name_, symbol_)
    {
        
        _sinceDate = block.timestamp;
        isActive = false;

        require(dacAddress_ != address(0x0), "Invalid dac address");
        _dacAddress = dacAddress_;
        _dacName = dacName_;

        require(underlyingAssetAddress_ != address(0x0), "Invalid Underlying Asset Address");
        _underlyingAssetAddress = underlyingAssetAddress_;
        assets.push(AssetParams(_underlyingAssetAddress, 0, 0));

        require(usdPriceModule_ != address(0x0), "Invalid USD price module address");
        _usdPriceModule = UsdPriceModule(usdPriceModule_);

        for (uint i=0; i<assetAddresses_.length; i++){
            require(assetAddresses_[i] != address(0x0), "Invalid underlying asset address");
            if(_underlyingAssetAddress == assetAddresses_[i]) {
                continue;
            }
            assets.push(AssetParams(assetAddresses_[i], 0, 0)); 
        }

        require((floatRatio_ >= 0) || (floatRatio_ <= 100000), "Invalid float ratio");
        _floatRatio = floatRatio_;
        
        require((deviationThreshold_ >= 0) || (deviationThreshold_ <= 10000), "Invalid Rebalance Threshold");
        _deviationThreshold = deviationThreshold_;

        factory = swapFactory_;
        router = IUniswapV2Router02(swapRouter_);
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

    function updateUsdPriceModule(address newUsdPriceModule) external onlyDac {
        require(newUsdPriceModule != address(0x0), "Invalid USD price module");
        require(newUsdPriceModule != address(_usdPriceModule), "Duplicated Vaule input");
        _usdPriceModule = UsdPriceModule(newUsdPriceModule);
    }

    // function updateSwapModule(address newSwapModule) external onlyDac {
    //     require(newSwapModule != address(0x0), "Invalid swap module");
    //     require(newSwapModule != address(_swapModule), "Duplicated Vaule input");
    //     _swapModule = ISwapModule(newSwapModule);
    // }

    ///@notice Add one underlying asset to be handled by the product. 
    ///@dev It is recommended to call updateWeight method after calling this method.
    function addAsset(address newAssetAddress) external onlyDac {
        require(newAssetAddress!=address(0x0), "Invalid asset address");
        require(!checkAsset(newAssetAddress), "Asset Already Exists");
        assets.push(AssetParams(newAssetAddress, 0, 0)); 
    }

    function addStrategy(address strategyAddress) external onlyDac {
        require(checkAsset(IStrategy(strategyAddress).underlyingAsset()), "Asset Doesn't Exist");
        require(strategyAddress!=address(0x0), "Invalid Strategy address");
        require(strategies[IStrategy(strategyAddress).underlyingAsset()] == address(0x0), "Strategy already exist");
        require(IStrategy(strategyAddress).dacAddress() == _dacAddress, "DAC conflict");
        strategies[IStrategy(strategyAddress).underlyingAsset()] = strategyAddress;
    }

    ///@notice update target weights and it will be used as a reference weight at the next rebalancing.
    function updateWeight(address[] memory assetAddresses, uint256[] memory assetWeights) external onlyDac {
        require(assetAddresses.length == assetWeights.length, "Invalid weight pair");
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
    function updateFloatRatio(uint256 newFloatRatio) external onlyDac {
        require(newFloatRatio != _floatRatio, "Duplicated Vaule input");
        require((newFloatRatio >= 0) || (newFloatRatio <= 100000), "Invalid float ratio");
        _floatRatio = newFloatRatio;
    }

    ///@notice Update rebalance threshold. It will reflect at the next rebalancing or withdrawal.
    function updateDeviationThreshold(uint256 newDeviationThreshold) external onlyDac {
        require(newDeviationThreshold != _deviationThreshold, "Duplicated Vaule input");
        require((newDeviationThreshold >= 0) || (newDeviationThreshold <= 10000), "Invalid Rebalance Threshold");
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

    // function currentSwapModule() public view returns(address) {
    //     return address(_swapModule);
    // }

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
        require(checkAsset(assetAddress), "Asset Doesn't Exist");
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
        require(shareValue(balanceOf(_dacAddress)) > (200 * 1e18));

        isActive = true;

        emit ActivateProduct(_msgSender(), block.timestamp);
    }

    function deactivateProduct() external onlyDac {
        require(isActive);

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

    function deposit(address assetAddress, uint256 assetAmount, address receiver) external override returns (uint256) {
        // dac은 deactive한 상태에도 넣을 수 있음
        // deactive임 + dac이 아님 -> deposit 불가능
        require((_msgSender() == _dacAddress) || isActive, "Deposit is disabled now");
        require(checkAsset(assetAddress), "Asset not found");
        // deposit 양 maxDeposit이랑 비교 -> 50(55)달러가 상한선
        // max deposit 계산 후 require
        uint256 depositValue = _usdPriceModule.getAssetUsdValue(assetAddress, assetAmount);
        require(depositValue < maxDepositValue(_msgSender()), "Too much deposit");

        // dollar 기준 가격으로 share 양 계산하기
        uint256 shareAmount = _valueToShares(depositValue);
        require(shareAmount > 0, "short of deposit");

        SafeERC20.safeTransfer(IERC20(assetAddress), address(this), assetAmount); // token, to, value
        _mint(receiver, shareAmount);

        emit Deposit(_msgSender(), receiver, assetAmount, shareAmount);
        return shareAmount;
    }

    function withdraw(address assetAddress, uint256 shareAmount, address receiver, address owner) external override returns (uint256) {
        require((_msgSender() != _dacAddress) || !isActive, "Withdrawal is disabled now");
        require(checkAsset(assetAddress), "Asset not found");

        // share값이 max인지 확인
        if(shareAmount == type(uint256).max) {
            shareAmount = balanceOf(owner);
        }

        // share Amount에 대한 유효성 검사 진행
        require(shareAmount <= balanceOf(owner), "Too much withdrawal");

        // 필요한 value가 얼만큼인지, asset으로 따지면 얼만큼이 되는지 확인
        uint256 withdrawalAmount = _valueToAssets(assetAddress, shareValue(shareAmount));
        require(withdrawalAmount > 0, "short of withdrawal");

        // 해당 withdrawalAmount를 asset의 float과 비교
        // asset의 float보다 withdrawalAmount가 크다면, 우선 float을 순회하고, 이후 withdrawal queue를 순회하는 로직이 필요
        if (_assetBalanceOf(assetAddress, address(this)) < withdrawalAmount) { // withdraw 해야 할 amount가 더 많은 상황 (1차 필터링)
            // 1차 float 확보 과정 - float을 돌면서 asset float 확보 
            for (uint i=0; i<assets.length; i++){
                // 만약, 현재 asset 주소랑 assets의 주소가 같으면 pass
                address floatAssetAddress = assets[i].assetAddress;
                if(floatAssetAddress == assetAddress) continue;

                // float Balance를 모두 확보 했는지 확인
                uint256 floatAmount= _assetBalanceOf(assetAddress, address(this));
                // 만약, 충분한 asset이 확보 되었다면 break (더 이상 자금을 확보할 이유가 없음)
                if(floatAmount >= withdrawalAmount) break;
                
                // 현재 탐색중인 float에서 확보해야만 하는 float balance가 얼마인지 확인
                uint256 needAmount = estimateSwapInputAmount(withdrawalAmount - floatAmount, floatAssetAddress, assetAddress);
                
                // 현재 탐색중인 float이 내가 확보해야만 하는 float balance보다 큰지, 작은지 비교 
                // 내가 확보해야하는 float balance가 더 크다면(=현재 탐색중이 float이 부족하다면) 
                // -> 현재 존재하는 float 전부를 withdraw 가능하도록 유저가 원하는 token으로 스왑 -> 일부분의 자금을 확보
                if(needAmount > _assetBalanceOf(floatAssetAddress, address(this))) {
                    needAmount =  _assetBalanceOf(floatAssetAddress, address(this));

                    // 해당 float에서 확보할 수 있는 자산이 하나도 없는 경우 pass
                    if(estimateSwapOutputAmount(needAmount, floatAssetAddress, assetAddress) == 0) continue;

                    // IERC20(floatAssetAddress).approve(getPairAddress(floatAssetAddress, assetAddress), needAmount);
                    IERC20(floatAssetAddress).approve(address(router), needAmount);
                    swapExactInput(needAmount, floatAssetAddress, assetAddress, address(this));
                }
                // 내가 확보해야하는 float balance가 더 작다면(=현재 탐색중인 float이 충분히 많은 경우) 
                // -> 현재 존재하는 float 중에서 필요한 balance 만큼만 스왑 -> 자금 확보
                else {
                    //IERC20(floatAssetAddress).approve(getPairAddress(assets[i].assetAddress, assetAddress), needAmount);
                    IERC20(floatAssetAddress).approve(address(router), needAmount);
                    swapExactOutput(withdrawalAmount - floatAmount, assets[i].assetAddress, assetAddress, address(this));
                }
            }

            // 2차 float 확보 과정 - withdrawal queue를 돌면서 asset float 확보
            for (uint i=0; i<withdrawalQueue.length; i++){
                // float Balance를 모두 확보 했는지 확인
                uint256 floatAmount = _assetBalanceOf(assetAddress, address(this));
                // 만약, 충분한 asset이 확보 되었다면 break (더 이상 자금을 확보할 이유가 없음)
                if(floatAmount >= withdrawalAmount) break;

                address strategyAssetAddress = IStrategy(withdrawalQueue[i]).underlyingAsset();
                // 유저가 원하는 assetAddress와 해당 strategy가 다루는 assetAddress가 같은지 확인
                if(assetAddress == strategyAssetAddress) { // asset address와 같은 경우
                    uint256 needAmount = 
                        withdrawalAmount - floatAmount > IStrategy(withdrawalQueue[i]).totalAssets() ?
                        IStrategy(withdrawalQueue[i]).totalAssets()
                        :
                        withdrawalAmount - floatAmount;
                    
                    // 인출 가능한 금액이 없음
                    if(needAmount == 0) continue;

                    // 인출 진행
                    _redeemFromStrategy(withdrawalQueue[i], needAmount);
                }
                else { // 다른 경우
                    // 현재 탐색중인 float에서 확보해야만 하는 float balance가 얼마인지 확인
                    uint256 needAmount = estimateSwapInputAmount(withdrawalAmount - floatAmount, strategyAssetAddress, assetAddress);
                    
                    // 현재 탐색중인 float이 내가 확보해야만 하는 float balance보다 큰지, 작은지 비교 
                    // 크다면 -> 현재 존재하는 float 전부를 withdraw 가능하도록 유저가 원하는 token으로 스왑 -> 일부분의 자금을 확보
                    if(needAmount > IStrategy(withdrawalQueue[i]).totalAssets()) {
                        needAmount =  IStrategy(withdrawalQueue[i]).totalAssets();

                        // 해당 float에서 확보할 수 있는 자산이 하나도 없는 경우 pass
                        if(estimateSwapOutputAmount(needAmount, strategyAssetAddress, assetAddress) == 0) continue;

                        //IERC20(strategyAssetAddress).approve(getPairAddress(strategyAssetAddress, assetAddress), needAmount);
                        IERC20(strategyAssetAddress).approve(address(router), needAmount);
                        swapExactInput(needAmount, strategyAssetAddress, assetAddress, address(this));
                    }
                    // 작다면 -> 현재 존재하는 float 중에서 필요한 balance 만큼만 스왑 -> 자금 확보
                    else {
                        //IERC20(strategyAssetAddress).approve((getPairAddress(strategyAssetAddress, assetAddress), needAmount);
                        IERC20(strategyAssetAddress).approve(address(router), needAmount);
                        swapExactOutput(withdrawalAmount - floatAmount, strategyAssetAddress, assetAddress, address(this));
                    }
                }
            }

            // float 확보 실패 - 확보한 float 만큼으로 강제로 withdraw 가능 amount 조정
            if(withdrawalAmount>IERC20(assetAddress).balanceOf(address(this))) {
                withdrawalAmount = IERC20(assetAddress).balanceOf(address(this));
                shareAmount = convertToShares(assetAddress, withdrawalAmount);
            }
        }
        
        // withdraw amount가 float보다 더 작은 상황 (1차 필터링 바로 성공)
        if(_msgSender() != owner) {
            _spendAllowance(owner, _msgSender(), shareAmount);
        }

        _burn(owner, shareAmount);
        SafeERC20.safeTransfer(IERC20(assetAddress), receiver, withdrawalAmount);

        emit Withdraw(msg.sender, receiver, owner, withdrawalAmount, shareAmount);
        return shareAmount;
    }

    function rebalance() external override onlyDac {
        require(isActive, "Product is disabled now");
        
        uint256 curretPortfolioValue = 0;
        for (uint i = 0; i < assets.length; i++) {
            assets[i].currentPrice = _usdPriceModule.getAssetUsdPrice(assets[i].assetAddress);
            curretPortfolioValue += assetValue(assets[i].assetAddress); // stratey + float value
        }

        // SELL
        for(uint i=0; i < assets.length; i++){
            uint256 targetBalance = ((assets[i].targetWeight * curretPortfolioValue) / 100000) / assets[i].currentPrice;
            uint256 currentBalance = assetBalance(assets[i].assetAddress); // current asset balance
            if (currentBalance > targetBalance*(100000 + _deviationThreshold)/100000) {
                uint256 sellAmount = currentBalance - targetBalance;
                require(_redeemFromStrategy(strategies[assets[i].assetAddress], sellAmount), "Redeem Failed");
            
                //IERC20(assets[i].assetAddress).approve(getPairAddress(), sellAmount);
                IERC20(assets[i].assetAddress).approve(address(router), sellAmount);
                swapExactInput(sellAmount, assets[i].assetAddress, _underlyingAssetAddress, address(this));
            }
        }

        // BUY
        for(uint i=0; i < assets.length; i++) {
            uint256 targetBalance = ((assets[i].targetWeight * curretPortfolioValue) / 100000) / assets[i].currentPrice;
            uint256 currentBalance = assetBalance(assets[i].assetAddress); // current asset balance
            IStrategy assetStrategy = IStrategy(strategies[assets[i].assetAddress]);
            if (currentBalance < targetBalance*(100000 - _deviationThreshold) / 100000) {
                uint256 buyAmount = targetBalance - currentBalance;

                uint256 amountInEstimated = estimateSwapInputAmount(buyAmount, _underlyingAssetAddress, assets[i].assetAddress);
                //IERC20(_underlyingAssetAddress).approve(_swapModule.getRouterAddress(), amountInEstimated);
                IERC20(_underlyingAssetAddress).approve(address(router), amountInEstimated);
                swapExactOutput(buyAmount, _underlyingAssetAddress, assets[i].assetAddress, address(this));
            }
            uint256 newFloatBalance = assetFloatBalance(assets[i].assetAddress);
            if(newFloatBalance > targetBalance*_floatRatio){
                require(_depositIntoStrategy(address(assetStrategy), newFloatBalance - targetBalance*_floatRatio), "Deposit into Strategy Failed");
            } 
        }
        
        emit Rebalance(address(this), assets, block.timestamp);
    }

    // 몇 달러 max로 deposit할 수 있는지 반환
    function maxDepositValue(address receiver) public view override returns (uint256){
        if(receiver == _dacAddress) return type(uint256).max;
        else return 55 * 1e18;
    } // for deposit

    // 몇 달러 max로 withdraw할 수 있는지 반환
    function maxWithdrawValue(address owner) public view override returns (uint256) {
        return shareValue(balanceOf(owner));
    } // for withdraw

    function _depositIntoStrategy(address strategyAddress, uint256 assetAmount) private returns(bool){
        require(isActive, "Product is disabled now");
        address assetAddress = IStrategy(strategyAddress).underlyingAsset();
         // 실패하면 revert
        SafeERC20.safeTransfer(IERC20(assetAddress), strategyAddress, assetAmount); // token, to, value
        return true;
    } 

    function _redeemFromStrategy(address strategyAddress, uint256 assetAmount) private returns(bool){
        return IStrategy(strategyAddress).withdrawToProduct(assetAmount);
    }

    // asset amount 받고, 이에 맞는 share 개수 반환
    function convertToShares(address assetAddress, uint256 assetAmount) public view override returns(uint256 shareAmount) {
        // assetAddress 존재 안하는거 확인 ?
        uint256 _assetValue = _usdPriceModule.getAssetUsdValue(assetAddress, assetAmount);
        return _valueToShares(_assetValue);
    }

    // share amount 받고, 이에 맞는 asset 개수 반환
    function convertToAssets(address assetAddress, uint256 shareAmount) public view override returns(uint256 assetAmount) {
        // assetAddress 존재 안하는거 확인 ?
        uint256 _shareValue = shareValue(shareAmount);
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
    // vault가 비어있어도 share가 존재한다는 가정 하에 _shareValue가 들어온 것이므로 shareValue를 토큰의 UsdPrice로 나눈 값을 반환
    function _valueToAssets(address _assetAddress, uint256 _shareValue) internal view returns(uint256 assetAmount) {
        return _shareValue / _usdPriceModule.getAssetUsdPrice(_assetAddress);
    }

    // shareToken 1개의 가격 정보 반환
    // vault가 비어있다면 1$ 반환
    function sharePrice() public view override returns(uint256) {
        return totalSupply() > 0 ? portfolioValue() * 1e18 / totalSupply() : 10**decimals();
    }

    // share Token 여러개의 가격 정보 반환
    // vault가 비어있다면 1개당 1$로 계산해서 반환
    function shareValue(uint256 shareAmount) public view override returns(uint256) {
        return totalSupply() > 0 ? (portfolioValue() * shareAmount) / totalSupply() : shareAmount;
    }
}