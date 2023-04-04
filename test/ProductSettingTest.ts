import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect } from "chai";
import priceFeedInterfaceABI from "../abis/priceFeedInterfaceABI.json";
import { Interface, parseEther, parseUnits } from "ethers/lib/utils";
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

/**
 * Product를 배포하고 실제 deposit과 withdraw를 진행하기 전, 
 * 기본적으로 필요한 contract들을 세팅하고
 * product 해당 값들이 잘 세팅되었는지 확인하는 test
 */
describe('Check initialization values when contacts deploy', () => {

  // Product의 constructor에 세팅된 값이 잘 들어갔고, 잘 반환되는지 확인
  it('Product Contracts constructor data setting test',async () => {
    const signers = await ethers.getSigners();
    const {
        product,
        usdPriceModule
    } = await utils.deployContracts(signers[0]);

    // Product test
    // current asset list 확인
    expect(await product.checkAsset(utils.wmaticAddress)).equal(true);
    expect(await product.checkAsset(utils.wethAddress)).equal(true);
    expect(await product.checkAsset(utils.ghstAddress)).equal(false);
    expect(await product.checkAsset(utils.quickAddress)).equal(false);
    expect(await product.checkAsset(utils.usdcAddress)).equal(true);
    expect(await product.checkAsset(utils.uniAddress)).equal(false);

    // dac information 확인
    expect(await product.dacName()).equal("Quinoa DAC");
    expect(await product.dacAddress()).equal(signers[0].address);

    // 기타 information 확인
    expect(await product.name()).equal("Quinoa test Product");
    expect(await product.symbol()).equal("qTEST");
    expect(await product.currentFloatRatio()).equal(20000);
    expect(await product.currentDeviationThreshold()).equal(5000);

    // usdPriceModue 확인
    expect(await product.currentUsdPriceModule()).equal(usdPriceModule.address);

    // active잘 막아져 있는지 확인
    expect(await product.checkActivation()).equal(false);
  });

  // strategy 처음에 잘 비어있는지 확인(동작 확인)
  it('Product-strategy test before strategy setting in product', async () => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy
    } = await utils.deployContracts(signers[0]);

    expect(await product.checkStrategy(wmaticStrategy.address)).equal(false);
    expect(await product.checkStrategy(wethStrategy.address)).equal(false);
    expect(await product.checkStrategy(ghstStrategy.address)).equal(false);
    expect(await product.checkStrategy(quickStrategy.address)).equal(false);
    expect(await product.checkStrategy(usdcStrategy.address)).equal(false);

  })

  it('Strategys constructor data setting test',async () => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy
    } = await utils.deployContracts(signers[0]);
    const {
        nonDacStrategy,
        diffAssetStrategy,
        dupStrategy
    } = await utils.depolyBadStrategies(signers[0], signers[1], product);

    // Strategy test
    // dac nondac 잘 세팅되었는지 확인
    expect(await wmaticStrategy.dacAddress()).equal(signers[0].address);
    expect(await wethStrategy.dacAddress()).equal(signers[0].address);
    expect(await ghstStrategy.dacAddress()).equal(signers[0].address);
    expect(await quickStrategy.dacAddress()).equal(signers[0].address);
    expect(await usdcStrategy.dacAddress()).equal(signers[0].address);
    expect(await diffAssetStrategy.dacAddress()).equal(signers[0].address);
    expect(await nonDacStrategy.dacAddress()).equal(signers[1].address);
    expect(await dupStrategy.dacAddress()).equal(signers[0].address);
  })

});

// constract를 실제 사용하기 전까지 잘 작동 세팅 되어 있는지 확인
describe('Check contracts setting value before real interacting with product contracts', () => {

  it('UsdPriceModule setting test', async() => {
    const signers = await ethers.getSigners();
    const {
        product,
        usdPriceModule
    } = await utils.deployContracts(signers[0]);

    await utils.setUsdPriceModule(signers[0], usdPriceModule);

    expect (await usdPriceModule.getUsdPriceFeed(utils.wmaticAddress)).equal(utils.wmaticOracle);
    expect (await usdPriceModule.getUsdPriceFeed(utils.wethAddress)).equal(utils.wethOracle);
    expect (await usdPriceModule.getUsdPriceFeed(utils.ghstAddress)).equal(utils.ghstOracle);
    expect (await usdPriceModule.getUsdPriceFeed(utils.quickAddress)).equal(utils.quickOracle);
    expect (await usdPriceModule.getUsdPriceFeed(utils.usdcAddress)).equal(utils.usdcOracle);
    expect (await usdPriceModule.getUsdPriceFeed(utils.uniAddress)).equal(utils.uniOracle);

    // oracle 가격 잘 불러와지는지 확인
    const wmaticPriceOracle = new ethers.Contract(utils.wmaticOracle, priceFeedInterfaceABI, signers[0]);
    const wethPriceOracle = new ethers.Contract(utils.wethOracle, priceFeedInterfaceABI, signers[0]);
    const ghstPriceOracle = new ethers.Contract(utils.ghstOracle, priceFeedInterfaceABI, signers[0]);
    const quickPriceOracle = new ethers.Contract(utils.quickOracle, priceFeedInterfaceABI, signers[0]);
    const usdcPriceOracle = new ethers.Contract(utils.usdcOracle, priceFeedInterfaceABI, signers[0]);
    const uniPriceOracle = new ethers.Contract(utils.uniOracle, priceFeedInterfaceABI, signers[0]);

    expect(((await wmaticPriceOracle.latestRoundData()).answer).mul(10**10)).equal(await usdPriceModule.getAssetUsdPrice(utils.wmaticAddress));
    expect(((await wethPriceOracle.latestRoundData()).answer).mul(10**10)).equal(await usdPriceModule.getAssetUsdPrice(utils.wethAddress));
    expect(((await ghstPriceOracle.latestRoundData()).answer).mul(10**10)).equal(await usdPriceModule.getAssetUsdPrice(utils.ghstAddress));
    expect(((await quickPriceOracle.latestRoundData()).answer).mul(10**10)).equal(await usdPriceModule.getAssetUsdPrice(utils.quickAddress));
    expect(((await usdcPriceOracle.latestRoundData()).answer).mul(10**10)).equal(await usdPriceModule.getAssetUsdPrice(utils.usdcAddress));
    expect(((await uniPriceOracle.latestRoundData()).answer).mul(10**10)).equal(await usdPriceModule.getAssetUsdPrice(utils.uniAddress));
  })

  it('Product setting',async () => {
    // 실제 product를 운용하기 전에, 각각의 값들이 잘 세팅되고 잘 변화하는지 확인
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
    } = await utils.deployContracts(signers[0]);

    // add asset 잘 되는지 test
    await product.addAsset(utils.ghstAddress);
    await product.addAsset(utils.quickAddress);
    expect(await product.checkAsset(utils.wmaticAddress)).equal(true);
    expect(await product.checkAsset(utils.wethAddress)).equal(true);
    expect(await product.checkAsset(utils.ghstAddress)).equal(true);
    expect(await product.checkAsset(utils.quickAddress)).equal(true);
    expect(await product.checkAsset(utils.usdcAddress)).equal(true);
    expect(await product.checkAsset(utils.uniAddress)).equal(false);


    await product.updateWeight([utils.usdcAddress, utils.ghstAddress, utils.wmaticAddress, utils.wethAddress, utils.quickAddress], [30000, 5000, 40000, 20000, 5000]);

    // strategy 잘 들어가는지 test
    await product.addStrategy(wmaticStrategy.address);
    await product.addStrategy(ghstStrategy.address);
    await product.addStrategy(quickStrategy.address);
    await product.addStrategy(wethStrategy.address);
    await product.addStrategy(usdcStrategy.address);

    expect(await product.checkStrategy(wmaticStrategy.address)).equal(true);
    expect(await product.checkStrategy(ghstStrategy.address)).equal(true);
    expect(await product.checkStrategy(quickStrategy.address)).equal(true);
    expect(await product.checkStrategy(wethStrategy.address)).equal(true);
    expect(await product.checkStrategy(usdcStrategy.address)).equal(true);

    expect(await product.currentStrategies()).include(wmaticStrategy.address);
    expect(await product.currentStrategies()).include(ghstStrategy.address);
    expect(await product.currentStrategies()).include(quickStrategy.address);
    expect(await product.currentStrategies()).include(wethStrategy.address);
    expect(await product.currentStrategies()).include(usdcStrategy.address);

    // withdrawal queue 잘 update 되는지 test
    await product.updateWithdrawalQueue([wmaticStrategy.address, wethStrategy.address, usdcStrategy.address, ghstStrategy.address, quickStrategy.address]);

  })

})

describe('Product update functions test', () => {
  //product의 update function들 잘 작동하는지 확인

  it('updateUsdPriceModule test', async() => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule
    } = await utils.deployContracts(signers[0]);

    await utils.setUsdPriceModule(signers[0], usdPriceModule);
    await utils.setProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.updateUsdPriceModule(ethers.constants.AddressZero)).to.be.revertedWithCustomError(product, "ZeroAddress");
    expect(product.updateUsdPriceModule(usdPriceModule.address)).to.be.revertedWithCustomError(product, "DuplicatedValue");
    expect(product.connect(signers[1]).updateUsdPriceModule(ethers.constants.AddressZero)).to.be.revertedWith('Only dac can access');
    await product.updateUsdPriceModule(signers[1].address);
    expect(await product.currentUsdPriceModule()).equal(signers[1].address);
  })

  it('updateFloatRatio test', async() => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule
    } = await utils.deployContracts(signers[0]);

    await utils.setUsdPriceModule(signers[0], usdPriceModule);
    await utils.setProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.updateFloatRatio(100000000000)).to.be.revertedWithCustomError(product, "OutOfRange");
    expect(product.updateFloatRatio(-3)).to.be.revertedWithCustomError(product, "OutOfRange");
    expect(product.updateFloatRatio(20000)).to.be.revertedWithCustomError(product, "DuplicatedValue");
    expect(product.connect(signers[1]).updateFloatRatio(15000)).to.be.revertedWith('Only dac can access');
    await product.updateFloatRatio(15000);
    expect(await product.currentFloatRatio()).equal(15000);
  })

  it('updateDeviationThreshold test', async() => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
    } = await utils.deployContracts(signers[0]);
    await utils.setProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.updateDeviationThreshold(100000000000)).to.be.revertedWithCustomError(product, "OutOfRange");
    expect(product.updateDeviationThreshold(-3)).to.be.revertedWithCustomError(product, "OutOfRange");
    expect(product.updateDeviationThreshold(5000)).to.be.revertedWithCustomError(product, "DuplicatedValue");
    expect(product.connect(signers[1]).updateDeviationThreshold(3000)).to.be.revertedWith('Only dac can access');
    await product.updateDeviationThreshold(3000);
    expect(await product.currentDeviationThreshold()).equal(3000);
  })

  it('updateWithdrawalQueue test', async() => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
    } = await utils.deployContracts(signers[0]);

    expect(product.connect(signers[1]).updateWithdrawalQueue([wethStrategy.address, usdcStrategy.address])).to.be.revertedWith('Only dac can access');
    expect(product.updateWithdrawalQueue([wmaticStrategy.address, wethStrategy.address, usdcStrategy.address, ghstStrategy.address, quickStrategy.address])).to.be.revertedWithCustomError(product, "ErrorWithMsg").withArgs(anyValue, "TooManyElements");
    expect(product.updateWithdrawalQueue([quickStrategy.address])).to.be.revertedWithCustomError(product, "NotFound");

    await product.addAsset(utils.ghstAddress);
    await product.addAsset(utils.quickAddress);
    await product.addStrategy(wmaticStrategy.address);
    await product.addStrategy(ghstStrategy.address);
    await product.addStrategy(quickStrategy.address);
    await product.addStrategy(wethStrategy.address);
    await product.addStrategy(usdcStrategy.address);
    await product.updateWithdrawalQueue([wmaticStrategy.address, wethStrategy.address, usdcStrategy.address]);

  })

  it('updateWeight test', async() => {
    const signers = await ethers.getSigners();
    const {
        product
    } = await utils.deployContracts(signers[0]);

    expect(product.connect(signers[1]).updateWeight([utils.usdcAddress,utils.wmaticAddress, utils.wethAddress], [30000, 40000, 30000])).to.be.revertedWith('Only dac can access');
    expect(product.updateWeight([utils.usdcAddress, utils.wethAddress], [30000, 40000, 30000])).to.be.revertedWithCustomError(product, "ErrorWithMsg").withArgs(anyValue, "pairConflict");
    expect(product.updateWeight([utils.usdcAddress, utils.ghstAddress, utils.wmaticAddress, utils.wethAddress, utils.quickAddress], [30000, 5000, 40000, 20000, 5000])).to.be.revertedWithCustomError(product, "NotFound");
    expect(product.updateWeight([utils.usdcAddress,utils.wmaticAddress, utils.wethAddress], [130000, 140000, 130000])).to.be.revertedWithCustomError(product,"OutOfRange");
    expect(product.updateWeight([utils.usdcAddress,utils.wmaticAddress, utils.wethAddress], [40000, 40000, 40000])).to.be.revertedWithCustomError(product,"OutOfRange");
    expect(product.updateWeight([utils.usdcAddress,utils.wmaticAddress, utils.wethAddress], [30000, 30000, 30000])).to.be.revertedWithCustomError(product,"OutOfRange");

    await product.updateWeight([utils.usdcAddress,utils.wmaticAddress, utils.wethAddress], [30000, 40000, 30000]);
  })

})

describe('Product add functions test', () => {
  //product의 update function들 잘 작동하는지 확인

  it('addAsset test', async() => {
    const signers = await ethers.getSigners();
    const {
        product
    } = await utils.deployContracts(signers[0]);
    // await setUsdPriceModule(usdPriceModule);
    // await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.addAsset(ethers.constants.AddressZero)).to.be.revertedWithCustomError(product, "ZeroAddress");
    expect(product.addAsset(utils.usdcAddress)).to.be.revertedWithCustomError(product, "DuplicatedValue");
    expect(product.connect(signers[1]).addAsset(utils.usdcAddress)).to.be.revertedWith("Only dac can access");
  })

  it('addStrategy test', async() => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        usdcStrategy,
        quickStrategy,
    } = await utils.deployContracts(signers[0]);
    const {
        nonDacStrategy,
        dupStrategy
    } = await utils.depolyBadStrategies(signers[0], signers[1], product);

    expect(product.addStrategy(ethers.constants.AddressZero)).to.be.revertedWithCustomError(product, "ZeroAddress");
    expect(product.connect(signers[1]).addStrategy(usdcStrategy.address)).to.be.revertedWith("Only dac can access");
    expect(product.addStrategy(quickStrategy.address)).to.be.revertedWithCustomError(product, "NotFound");
    expect(product.addStrategy(nonDacStrategy.address)).to.be.revertedWithCustomError(product, "ErrorWithMsg").withArgs(anyValue, "strategyDacConflict");

    await product.addStrategy(wmaticStrategy.address);
    expect(product.addStrategy(dupStrategy.address)).to.be.revertedWithCustomError(product, "DuplicatedValue");
  })

})

describe('Product balance/price functions test', () => {
  // product의 price 와 balance 관련 function들 잘 작동하는지 확인

  it('maxDeposit test', async() => {
    const signers = await ethers.getSigners();
    const {
        product
    } = await utils.deployContracts(signers[0]);

    expect(await product.maxDepositValue(signers[0].address)).equal(ethers.constants.MaxUint256);
    expect(await product.maxDepositValue(signers[1].address)).equal(55000000000000000000n);
  })

  it('maxWithdrawValue test', async() => {
    const signers = await ethers.getSigners();
    const {
        product
    } = await utils.deployContracts(signers[0]);

    expect(await product.maxWithdrawValue(signers[0].address)).equal(0);
    expect(await product.maxWithdrawValue(signers[1].address)).equal(0);
  })

  it('convertToShare test', async () => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule
    } = await utils.deployContracts(signers[0]);
    await utils.setUsdPriceModule(signers[0], usdPriceModule);
    await utils.setProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    let wmaticPrice = (await usdPriceModule.getAssetUsdPrice(utils.wmaticAddress)).toString();
    let usdcPrice = (await usdPriceModule.getAssetUsdPrice(utils.usdcAddress)).toString();

    expect(((await product.convertToShares(utils.wmaticAddress, ethers.utils.parseUnits("100.0", 18)))).toString()).equal(wmaticPrice + '00');
    expect((await product.convertToShares(utils.usdcAddress, ethers.utils.parseUnits("10.0", 6))).toString()).equal(usdcPrice + '0');

  })

  it('convertToAsset test', async () => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule
    } = await utils.deployContracts(signers[0]);
    await utils.setUsdPriceModule(signers[0], usdPriceModule);
    await utils.setProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    let wmaticPrice = (await usdPriceModule.getAssetUsdPrice(utils.wmaticAddress));
    let usdcPrice = (await usdPriceModule.getAssetUsdPrice(utils.usdcAddress));

    expect(((await product.convertToAssets(utils.wmaticAddress, wmaticPrice.mul(100))).toString())).equal(parseEther("100"));
    expect(((await product.convertToAssets(utils.usdcAddress, usdcPrice.mul(1000))).toString())).equal(parseUnits("1000", 6));

  })

  it('sharePrice & shareValue test', async () => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule
    } = await utils.deployContracts(signers[0]);
    await utils.setUsdPriceModule(signers[0], usdPriceModule);
    await utils.setProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    // product에 0원 있을 때
    expect(await product.sharePrice()).equal(ethers.utils.parseUnits("1.0", 18));
    expect(await product.shareValue(ethers.utils.parseUnits("100000.0", 18))).equal(ethers.utils.parseUnits("100000.0", 18));
    expect(await product.shareValue(ethers.utils.parseUnits("1342934.0", 18))).equal(ethers.utils.parseUnits("1342934.0", 18));

    // product에 돈이 있을 때 → matic을 wMatic으로 바꾸어야 하는데 ..흐음
    // await product.deposit(wmaticAddress, ethers.utils.parseUnits("200.0", 6), dac.address);

  })

  it('balance function test', async () => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule
    } = await utils.deployContracts(signers[0]);
    await utils.setUsdPriceModule(signers[0], usdPriceModule);
    await utils.setProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    // product에 돈 0원 있을 때
    expect(product.assetFloatBalance(utils.uniAddress)).to.be.revertedWithCustomError(product, "NotFound");
    expect(await product.assetFloatBalance(utils.usdcAddress)).equal(0);
    expect(await product.assetFloatBalance(utils.wmaticAddress)).equal(0);
    expect(await product.assetFloatBalance(utils.quickAddress)).equal(0);
    expect(await product.assetFloatBalance(utils.ghstAddress)).equal(0);
    expect(await product.assetFloatBalance(utils.wethAddress)).equal(0);

    expect(product.assetBalance(utils.uniAddress)).to.be.revertedWithCustomError(product, "NotFound");
    expect(await product.assetBalance(utils.usdcAddress)).equal(0);
    expect(await product.assetBalance(utils.wmaticAddress)).equal(0);
    expect(await product.assetBalance(utils.quickAddress)).equal(0);
    expect(await product.assetBalance(utils.ghstAddress)).equal(0);
    expect(await product.assetBalance(utils.wethAddress)).equal(0);
  })

  it('value function test', async () => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule
    } = await utils.deployContracts(signers[0]);
    await utils.setUsdPriceModule(signers[0], usdPriceModule);
    await utils.setProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(await product.portfolioValue()).equal(0);
    expect(await product.totalFloatValue()).equal(0);

    expect(product.assetValue(utils.uniAddress)).to.be.revertedWithCustomError(product, "NotFound");
    expect(await product.assetValue(utils.usdcAddress)).equal(0);
    expect(await product.assetValue(utils.wmaticAddress)).equal(0);
    expect(await product.assetValue(utils.quickAddress)).equal(0);
    expect(await product.assetValue(utils.ghstAddress)).equal(0);
    expect(await product.assetValue(utils.wethAddress)).equal(0);

    expect(product.assetFloatValue(utils.uniAddress)).to.be.revertedWithCustomError(product, "NotFound");
    expect(await product.assetFloatValue(utils.usdcAddress)).equal(0);
    expect(await product.assetFloatValue(utils.wmaticAddress)).equal(0);
    expect(await product.assetFloatValue(utils.quickAddress)).equal(0);
    expect(await product.assetFloatValue(utils.ghstAddress)).equal(0);
    expect(await product.assetFloatValue(utils.wethAddress)).equal(0);

  })

})
