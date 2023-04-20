import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect, util } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";

describe('activation test',async () => {
   // 이때, activateProduct -> onlyDac check, 설정이 다 안되어 있을 때 activate 안되는거 확인
  it('Product activation failuer test',async () => {
    const [dac, nonDac] = await ethers.getSigners();
    const {
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule,
        whitelistRegistry
    } = await utils.deployContracts("Product", dac);
    await utils.setUsdPriceModule(dac, usdPriceModule);

    const wMaticContract = new ethers.Contract(utils.wmaticAddress, utils.wMaticAbi, dac);
    // dac get wmatic
    await wMaticContract.connect(dac).deposit
    ({
        from: dac.address,
        value: ethers.utils.parseEther("300"),
        gasLimit: 59999,
    });
    // nonDac get wmatic
    await wMaticContract.connect(dac).deposit
    ({
        from: dac.address,
        value: ethers.utils.parseEther("300"),
        gasLimit: 59999,
    });

    const Product = await ethers.getContractFactory("Product");

    const productInfo = {
      productName: "Quinoa test Product",
      productSymbol: "qTEST",
      dacName: "Quinoa DAC",
      dacAddress: dac.address,
      underlyingAssetAddress: utils.usdcAddress,
      floatRatio: 20000,
      deviationThreshold: 5000
    }

    const product = await Product.deploy(productInfo, whitelistRegistry.address, usdPriceModule.address, usdPriceModule.address, [utils.wmaticAddress, utils.wethAddress], utils.quickSwapFactory, utils.quickSwapRouter);
    await product.deployed();

    // strategy가 맞게 존재하는지 확인
    await product.addAsset(utils.ghstAddress);
    await product.addAsset(utils.quickAddress);
    expect(product.activateProduct()).revertedWith("No strategies");
    // asset weight 확인
    await product.addStrategy(wmaticStrategy.address);
    await product.addStrategy(ghstStrategy.address);
    await product.addStrategy(quickStrategy.address);
    await product.addStrategy(wethStrategy.address);
    await product.addStrategy(usdcStrategy.address);  
    expect(product.activateProduct()).revertedWith("Sum of target weights is not 100%");
    // withdrawal queue 확인
    await product.updateWeight(
      [utils.usdcAddress, utils.ghstAddress, utils.wmaticAddress, utils.wethAddress, utils.quickAddress],
      [30000, 5000, 40000, 20000, 5000]
    );
    expect(product.activateProduct()).revertedWith("No withdrawal Queue");
    // dac이 200 달러 아래로 넣은거 확인
    await product.updateWithdrawalQueue([
      wmaticStrategy.address,
      wethStrategy.address,
      usdcStrategy.address,
      ghstStrategy.address,
      quickStrategy.address,
    ]);
    expect(product.activateProduct()).revertedWith("Dac's deposit balance is too lower");
    // 이미 activation 상태인거 확인
    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(utils.wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    // dac이 아닌 사람은 activate 불가능
    expect(product.connect(nonDac).activateProduct()).revertedWith("Only dac can access");
    // 이미 activation 상태라면 activate 불가능
    await product.activateProduct();
    expect(product.activateProduct()).revertedWith("Already activation state");

  })

  // dac이 200 달러 이상으로 입금한 경우 : wmatic in - wmatic out -> acitvation 확인
  it('Product activation test',async () => {
    const [dac, nonDac] = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule,
        whitelistRegistry
    } = await utils.deployContracts("Product", dac);
    await utils.setUsdPriceModule(dac, usdPriceModule);
    await utils.setProductWithAllStrategies(dac, product, wmaticStrategy, wethStrategy, usdcStrategy, ghstStrategy, quickStrategy);
    
    const {
        wMaticContract,
        usdcContract,
    } = await utils.distributionTokens([dac, nonDac]);

    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(utils.wmaticAddress, ethers.utils.parseEther("200"), dac.address);

    expect(await product.checkActivation()).equal(false);
    await product.activateProduct();
    expect(await product.checkActivation()).equal(true);
  })

})


describe('Deposit wmatic tokens into product contract & withdraw wmatic tokens',async () => {

  it('deposit failure test: deactivation status',async () => {
    const [dac, nonDac] = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule,
        whitelistRegistry
    } = await utils.deployContracts("Product", dac);
    await utils.setUsdPriceModule(dac, usdPriceModule);
    await utils.setProductWithAllStrategies(dac, product, wmaticStrategy, wethStrategy, usdcStrategy, ghstStrategy, quickStrategy);
  
    await utils.setWhitelists([nonDac], whitelistRegistry, product.address);
    expect(product.connect(nonDac).deposit(utils.wmaticAddress, ethers.utils.parseEther("100"), dac.address)).revertedWith("Deposit is disabled now");
  })

  it('wmatic in - wmatic out test: only dac',async () => {
    const [dac, nonDac] = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule,
        whitelistRegistry
    } = await utils.deployContracts("Product", dac);
    await utils.setUsdPriceModule(dac, usdPriceModule);
    await utils.setProductWithAllStrategies(dac, product, wmaticStrategy, wethStrategy, usdcStrategy, ghstStrategy, quickStrategy);
    const {
        wMaticContract
      } = await utils.distributionTokens([dac, nonDac]);
  
    let wMaticBalance = await wMaticContract.balanceOf(dac.address);
    let wMaticValue_100 = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, ethers.utils.parseEther("100"));

    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("100"));
    await product.connect(dac).deposit(utils.wmaticAddress, ethers.utils.parseEther("100"), dac.address);

    // deposit wmatic 100개
    expect(await product.portfolioValue()).equal(wMaticValue_100)
    expect(await wMaticContract.balanceOf(dac.address)).equal(wMaticBalance.sub(ethers.utils.parseEther("100")));
    expect(await product.totalSupply()).equal(wMaticValue_100);
    expect(await product.sharePrice()).equal(ethers.utils.parseEther("1"));
    expect(await product.balanceOf(dac.address)).equal(wMaticValue_100);

    // withdraw 123.1 ??
    await product.connect(dac).withdraw(utils.wmaticAddress, ethers.constants.MaxUint256, dac.address, dac.address);
    expect((await product.portfolioValue()).toString()).equal("0");
    expect(await wMaticContract.balanceOf(dac.address)).equal(wMaticBalance);
    expect((await product.totalSupply()).toString()).equal("0");
    expect(await product.sharePrice()).equal(ethers.utils.parseEther("1"));
    expect((await product.balanceOf(dac.address)).toString()).equal("0");
  })

  // wmatic in - wmatic out -> activation + nonDac 제한 확인
  it('wmatic in - wmatic out test: nonDac maxDeposit',async () => {
    const [dac, nonDac] = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule,
        whitelistRegistry
    } = await utils.deployContracts("Product", dac);
    await utils.setUsdPriceModule(dac, usdPriceModule);
    await utils.setProductWithAllStrategies(dac, product, wmaticStrategy, wethStrategy, usdcStrategy, ghstStrategy, quickStrategy);

    const {
        wMaticContract,
        wEthContract,
        usdcContract,
        swapContract
    } = await utils.distributionTokens([dac, nonDac]);

    let dacDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, ethers.utils.parseEther("200"));
    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(utils.wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    await product.activateProduct();

    expect(product.connect(nonDac).deposit(utils.usdcAddress, parseUnits("50", 6), nonDac.address)).revertedWith("You're not in whitelist");

    // nonDac이 55 달러 이상 낸다고 햇을 때 -> 거절
    await utils.setWhitelists([nonDac], whitelistRegistry, product.address);

    let nonDacDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, ethers.utils.parseEther("100"));
    await wMaticContract.connect(nonDac).approve(product.address, ethers.utils.parseEther("100"));
    expect(product.connect(nonDac).deposit(utils.wmaticAddress, ethers.utils.parseEther("100"), nonDac.address)).revertedWith("Too much deposit");

    // nonDac이 55 달러 이하 낸다고 했을 때 -> 승인
    nonDacDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, ethers.utils.parseEther("30"));
    expect(await product.connect(nonDac).callStatic.deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)).equal(nonDacDepositValue);
    await product.connect(nonDac).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), nonDac.address);

    expect(await product.portfolioValue()).equal(dacDepositValue.add(nonDacDepositValue));
    expect(await product.sharePrice()).equal(parseEther("1"));
    expect(await product.maxWithdrawValue(dac.address)).equal(dacDepositValue);
    expect(await product.maxWithdrawValue(nonDac.address)).equal(nonDacDepositValue)

  }) 

  // wmatic in - wmatic out -> actibation(checkActivation) -> dac + nonDac -> withdraw test
  it('wmatic in - wmatic out: nonDac withdraw test',async () => {
    const [dac, nonDac] = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule,
        whitelistRegistry
    } = await utils.deployContracts("Product", dac);
    await utils.setUsdPriceModule(dac, usdPriceModule);
    await utils.setProductWithAllStrategies(dac, product, wmaticStrategy, wethStrategy, usdcStrategy, ghstStrategy, quickStrategy);

    const {
        wMaticContract
    } = await utils.distributionTokens([dac, nonDac]);

    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(utils.wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    await product.activateProduct();

    let nonDaoWmaticBalance = await wMaticContract.balanceOf(nonDac.address);
    await utils.setWhitelists([nonDac], whitelistRegistry, product.address);
    await wMaticContract.connect(nonDac).approve(product.address, ethers.utils.parseEther("100"));
    await product.connect(nonDac).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)
    await product.connect(nonDac).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)
    await product.connect(nonDac).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)

    let nonDacDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("90"));
    expect(await wMaticContract.balanceOf(nonDac.address)).equal(nonDaoWmaticBalance.sub(parseEther("90")));
    expect(await product.balanceOf(nonDac.address)).equal(nonDacDepositValue);
    expect(await product.shareValue(await product.balanceOf(nonDac.address))).equal(nonDacDepositValue);
    expect(await product.convertToAssets(utils.wmaticAddress, await product.balanceOf(nonDac.address))).equal(parseEther("90"));
    expect(await product.convertToAssets(utils.wmaticAddress, await product.totalSupply())).equal(parseEther("290"));

    let nonDacWithdrawValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("50"));
    let nonDacWithdrawalShreBalance = await product.convertToShares(utils.wmaticAddress, parseEther("50"));
    expect(await product.maxWithdrawValue(nonDac.address)).equal(nonDacDepositValue);
    expect(product.connect(dac).withdraw(utils.wmaticAddress, ethers.constants.MaxUint256, dac.address, dac.address)).revertedWith("Withdrawal is disabled now");
    await product.connect(nonDac).withdraw(utils.wmaticAddress, nonDacWithdrawalShreBalance, nonDac.address, nonDac.address);

    expect(await wMaticContract.balanceOf(nonDac.address)).equal(nonDaoWmaticBalance.sub(parseEther("40")));
    expect(await product.balanceOf(nonDac.address)).equal(nonDacDepositValue.sub(nonDacWithdrawValue));
    expect(await product.shareValue(await product.balanceOf(nonDac.address))).equal(nonDacDepositValue.sub(nonDacWithdrawValue));
    expect(await product.convertToAssets(utils.wmaticAddress, await product.balanceOf(nonDac.address))).equal(parseEther("40"));
    expect(await product.convertToAssets(utils.wmaticAddress, await product.totalSupply())).equal(parseEther("240"));
  })

  // wamtic in - wmatic out -> activation(checkActivation) -> dac + onnDac -> maxWithdraw test
  it('wmatic in - wmatic out: nonDac max withdraw test',async () => {
    const [dac, nonDac] = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule,
        whitelistRegistry
    } = await utils.deployContracts("Product", dac);
    await utils.setUsdPriceModule(dac, usdPriceModule);
    await utils.setProductWithAllStrategies(dac, product, wmaticStrategy, wethStrategy, usdcStrategy, ghstStrategy, quickStrategy);
    
    const {
        wMaticContract
    } = await utils.distributionTokens([dac, nonDac]);
    await utils.activateProduct(dac, product, wMaticContract);
      
    await utils.setWhitelists([nonDac], whitelistRegistry, product.address);

    let nonDaoWmaticBalance = await wMaticContract.balanceOf(nonDac.address);
    await wMaticContract.connect(nonDac).approve(product.address, ethers.utils.parseEther("100"));
    await product.connect(nonDac).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)
    await product.connect(nonDac).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)
    await product.connect(nonDac).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)

    let nonDacDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("90"));
    expect(await wMaticContract.balanceOf(nonDac.address)).equal(nonDaoWmaticBalance.sub(parseEther("90")));
    expect(await product.balanceOf(nonDac.address)).equal(nonDacDepositValue);
    expect(await product.shareValue(await product.balanceOf(nonDac.address))).equal(nonDacDepositValue);
    expect(await product.convertToAssets(utils.wmaticAddress, await product.balanceOf(nonDac.address))).equal(parseEther("90"));
    expect(await product.convertToAssets(utils.wmaticAddress, await product.totalSupply())).equal(parseEther("290"));

    let dacDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("200"));
    expect(await product.maxWithdrawValue(nonDac.address)).equal(nonDacDepositValue);
    await product.connect(nonDac).withdraw(utils.wmaticAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);

    expect(await wMaticContract.balanceOf(nonDac.address)).equal(nonDaoWmaticBalance);
    expect(await product.balanceOf(nonDac.address)).equal(parseEther("0"));
    expect(await product.shareValue(await product.balanceOf(nonDac.address))).equal(parseEther("0"));
    expect(await product.totalSupply()).equal(dacDepositValue)
    expect(await product.convertToAssets(utils.wmaticAddress, await product.balanceOf(nonDac.address))).equal(parseEther("0"));
    expect(await product.convertToAssets(utils.wmaticAddress, await product.totalSupply())).equal(parseEther("200"));
  })
})
 

describe('decimal 18 in-out',async () => {
  it('wmatic in - weth out',async () => {
    const [dac, nonDac] = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule,
        whitelistRegistry
    } = await utils.deployContracts("Product", dac);
    await utils.setUsdPriceModule(dac, usdPriceModule);
    await utils.setProductWithAllStrategies(dac, product, wmaticStrategy, wethStrategy, usdcStrategy, ghstStrategy, quickStrategy);

    const {
        wMaticContract,
    } = await utils.distributionTokens([dac, nonDac]);
    await utils.activateProduct(dac, product, wMaticContract);

    // wmatic으로 30 token deposit
    await utils.setWhitelists([nonDac], whitelistRegistry, product.address);

    await wMaticContract.connect(nonDac).approve(product.address, ethers.utils.parseEther("100"));
    await product.connect(nonDac).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), nonDac.address) // wmatic deposit


    // weth로 전부 withdraw
    await product.connect(nonDac).withdraw(utils.wethAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
    
    await product.deactivateProduct();
    await product.withdraw(utils.wmaticAddress, ethers.constants.MaxUint256, dac.address, dac.address);
  })
})

describe.only('wmatic in - usdc out',async () => {
  it('wmatic in - usdc out',async () => {
    const [dac, nonDac] = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule,
        whitelistRegistry
    } = await utils.deployContracts("Product", dac);
    await utils.setUsdPriceModule(dac, usdPriceModule);
    await utils.setProductWithAllStrategies(dac, product, wmaticStrategy, wethStrategy, usdcStrategy, ghstStrategy, quickStrategy);

    const {
        wMaticContract,
        usdcContract,
    } = await utils.distributionTokens([dac, nonDac]);
    await utils.activateProduct(dac, product, wMaticContract);

    // wmatic으로 30 token deposit
    await utils.setWhitelists([nonDac], whitelistRegistry, product.address);
    await wMaticContract.connect(nonDac).approve(product.address, ethers.utils.parseEther("100"));
    await product.connect(nonDac).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)
    let beforePortfolio = await product.portfolioValue();
    let beforeProductWmatic = await product.assetBalance(utils.wmaticAddress);
    console.log("user's deposit value: ", await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("30")));
    console.log("product's total portfolio value: ", beforePortfolio);
    console.log("product's wmatic balance: ", beforeProductWmatic);

    // usdc로 전부 withdraw
    await product.connect(nonDac).withdraw(utils.usdcAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
    let afterPortfolio =  await product.portfolioValue();
    let afterProductWmatic = await product.assetBalance(utils.wmaticAddress);
    let userWithdrawalValue = await usdPriceModule.getAssetUsdValue(utils.usdcAddress, await usdcContract.balanceOf(nonDac.address));
    console.log("user's withdraw value: ", userWithdrawalValue);
    console.log("product's total portfolio value: ",afterPortfolio);
    console.log("product's wmatic balance: ",afterProductWmatic);

    console.log("------------------------------------------------------------------")
   
    console.log("product portfolio before - after: ", beforePortfolio.sub(afterPortfolio));
    console.log("wmatic balance before - after: ", beforeProductWmatic.sub(afterProductWmatic));
    console.log("before portfolio - after portfolio vs withdraw value: ", beforePortfolio.sub(afterPortfolio).add(userWithdrawalValue));
    
  })
})
