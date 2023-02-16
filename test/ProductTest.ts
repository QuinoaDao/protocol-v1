import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";

// Test 완료
describe('Product Depoly Test', () => {

  it('Contacts deploy test', async () => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy,
        usdPriceModule,
        whitelistRegistry
    } = await utils.deployContracts(signers[0]);
    const {
        nonDacStrategy,
        diffAssetStrategy,
        dupStrategy
    } = await utils.depolyBadStrategy(signers[0], signers[1], product);

    console.log('Product address', product.address);
    console.log('Wmatic Strategy address', wmaticStrategy.address);
    console.log('WETH Strategy address', wethStrategy.address);
    console.log('Ghst Strategy address', ghstStrategy.address);
    console.log('Quick Strategy address', quickStrategy.address);
    console.log('USDC Strategy address', usdcStrategy.address);
    console.log('USD Price Module address', usdPriceModule.address);
    console.log('Non Dac Strategy address', nonDacStrategy.address);
    console.log('Diff Asset Strategy address', diffAssetStrategy.address);
    console.log('Dup Strategy address', dupStrategy.address);
  })

  it('Contracts constructor data test',async () => {
    // Product의 constructor에 세팅된 값이 잘 들어갔고, 잘 반환되는지 확인
    const signers = await ethers.getSigners();
    const {
        product,
        usdPriceModule
    } = await utils.deployContracts(signers[0]);

    // Product test
    // currnet asset list 확인
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

    // sinceDate 확인
    console.log(await product.sinceDate());

    // usdPriceModue 확인
    expect(await product.currentUsdPriceModule()).equal(usdPriceModule.address);

    // active잘 막아져 있는지 확인
    expect(await product.checkActivation()).equal(false);
  });

  it('Product-strategy test', async () => {
    const signers = await ethers.getSigners();
    const {
        product,
        wmaticStrategy,
        wethStrategy,
        usdcStrategy,
        ghstStrategy,
        quickStrategy
    } = await utils.deployContracts(signers[0]);

    // strategy 처음에 잘 비어있는지 확인(동작 확인)
    console.log("current strategy state: ", await product.currentStrategies());
    expect(await product.checkStrategy(wmaticStrategy.address)).equal(false);
    expect(await product.checkStrategy(wethStrategy.address)).equal(false);
    expect(await product.checkStrategy(ghstStrategy.address)).equal(false);
    expect(await product.checkStrategy(quickStrategy.address)).equal(false);
    expect(await product.checkStrategy(usdcStrategy.address)).equal(false);

    // withdrawal queue 처음에 잘 비어있는지 확인
    console.log("current withdrawal queue state: ", await product.withdrawalQueue);
  })

  it('Strategy constructor test',async () => {
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
    } = await utils.depolyBadStrategy(signers[0], signers[1], product);

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

describe('Contract setting test', () => {
  // constract를 실제 사용하기 전까지 잘 작동 세팅 되어 있는지 확인

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
    console.log("wmatic current price: ", await usdPriceModule.getAssetUsdPrice(utils.wmaticAddress));
    console.log("weth current price: ", await usdPriceModule.getAssetUsdPrice(utils.wethAddress));
    console.log("ghst current price: ", await usdPriceModule.getAssetUsdPrice(utils.ghstAddress));
    console.log("quick current price: ", await usdPriceModule.getAssetUsdPrice(utils.quickAddress));
    console.log("usdc current price: ", await usdPriceModule.getAssetUsdPrice(utils.usdcAddress));
    console.log("uni current price: ", await usdPriceModule.getAssetUsdPrice(utils.uniAddress));
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

    // // weight 잘 들어가는지 test
    // console.log(await product.currentAssets());
    // tickers = {'MATIC':0.4, 'ETH': 0.2, 'GHST': 0.05, 'QUICK':0.05, 'USDC': 0.3}
    await product.updateWeight([utils.usdcAddress, utils.ghstAddress, utils.wmaticAddress, utils.wethAddress, utils.quickAddress], [30000, 5000, 40000, 20000, 5000]);
    // console.log(await product.currentAssets());

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

    // console.log(await product.currentStrategies());
    // console.log([wmaticStrategy.address, ghstStrategy.address, quickStrategy.address, wethStrategy.address, usdcStrategy.address]);
    expect(await product.currentStrategies()).include(wmaticStrategy.address);
    expect(await product.currentStrategies()).include(ghstStrategy.address);
    expect(await product.currentStrategies()).include(quickStrategy.address);
    expect(await product.currentStrategies()).include(wethStrategy.address);
    expect(await product.currentStrategies()).include(usdcStrategy.address);

    // withdrawal queue 잘 update 되는지 test
    await product.updateWithdrawalQueue([wmaticStrategy.address, wethStrategy.address, usdcStrategy.address, ghstStrategy.address, quickStrategy.address]);
    /**
    // current withdrawal queue function은 삭제함 - public이라서 필요 X
    // expect((await product.currentWithdrawalQueue())[0]).equal(wmaticStrategy.address);
    // expect((await product.currentWithdrawalQueue())[1]).equal(wethStrategy.address);
    // expect((await product.currentWithdrawalQueue())[2]).equal(usdcStrategy.address);
    // expect((await product.currentWithdrawalQueue())[3]).equal(ghstStrategy.address);
    // expect((await product.currentWithdrawalQueue())[4]).equal(quickStrategy.address);
    */
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
    await utils.setProductWithAllStrategy(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.updateUsdPriceModule(ethers.constants.AddressZero)).to.be.revertedWith('Invalid USD price module');
    expect(product.updateUsdPriceModule(usdPriceModule.address)).to.be.revertedWith('Duplicated Vaule input');
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
    await utils.setProductWithAllStrategy(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.updateFloatRatio(100000000000)).to.be.revertedWith("Invalid float ratio");
    expect(product.updateFloatRatio(-3)).to.be.revertedWith("Invalid float ratio");
    expect(product.updateFloatRatio(20000)).to.be.revertedWith('Duplicated Vaule input');
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
    await utils.setProductWithAllStrategy(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.updateDeviationThreshold(100000000000)).to.be.revertedWith("Invalid Rebalance Threshold");
    expect(product.updateDeviationThreshold(-3)).to.be.revertedWith("Invalid Rebalance Threshold");
    expect(product.updateDeviationThreshold(5000)).to.be.revertedWith('Duplicated Vaule input');
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
    expect(product.updateWithdrawalQueue([wmaticStrategy.address, wethStrategy.address, usdcStrategy.address, ghstStrategy.address, quickStrategy.address])).to.be.revertedWith('Too many elements');
    expect(product.updateWithdrawalQueue([quickStrategy.address])).to.be.revertedWith("Strategy doesn't exist");

    // console.log(await product.currentWithdrawalQueue());
    await product.addAsset(utils.ghstAddress);
    await product.addAsset(utils.quickAddress);
    await product.addStrategy(wmaticStrategy.address);
    await product.addStrategy(ghstStrategy.address);
    await product.addStrategy(quickStrategy.address);
    await product.addStrategy(wethStrategy.address);
    await product.addStrategy(usdcStrategy.address);
    await product.updateWithdrawalQueue([wmaticStrategy.address, wethStrategy.address, usdcStrategy.address]);

    // let currentWithdrawalQueue = await product.currentWithdrawalQueue();
    // expect(currentWithdrawalQueue).include(wmaticStrategy.address);
    // expect(currentWithdrawalQueue).include(wethStrategy.address);
    // expect(currentWithdrawalQueue).include(usdcStrategy.address);
    // console.log(await product.currentWithdrawalQueue());

  })

  it('updateWeight test', async() => {
    const signers = await ethers.getSigners();
    const {
        product
    } = await utils.deployContracts(signers[0]);

    expect(product.connect(signers[1]).updateWeight([utils.usdcAddress,utils.wmaticAddress, utils.wethAddress], [30000, 40000, 30000])).to.be.revertedWith('Only dac can access');
    expect(product.updateWeight([utils.usdcAddress, utils.wethAddress], [30000, 40000, 30000])).to.be.revertedWith('Invalid weight pair');
    expect(product.updateWeight([utils.usdcAddress, utils.ghstAddress, utils.wmaticAddress, utils.wethAddress, utils.quickAddress], [30000, 5000, 40000, 20000, 5000])).to.be.revertedWith('Asset not found');
    expect(product.updateWeight([utils.usdcAddress,utils.wmaticAddress, utils.wethAddress], [130000, 140000, 130000])).to.be.revertedWith('Invalid asset target weight');
    expect(product.updateWeight([utils.usdcAddress,utils.wmaticAddress, utils.wethAddress], [40000, 40000, 40000])).to.be.revertedWith('Sum of asset weights is not 100%');
    expect(product.updateWeight([utils.usdcAddress,utils.wmaticAddress, utils.wethAddress], [30000, 30000, 30000])).to.be.revertedWith('Sum of asset weights is not 100%');

    console.log(await product.currentAssets());
    await product.updateWeight([utils.usdcAddress,utils.wmaticAddress, utils.wethAddress], [30000, 40000, 30000]);
    console.log(await product.currentAssets());
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

    expect(product.addAsset(ethers.constants.AddressZero)).to.be.revertedWith("Invalid asset address");
    expect(product.addAsset(utils.usdcAddress)).to.be.revertedWith("Asset Already Exists");
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
    } = await utils.depolyBadStrategy(signers[0], signers[1], product);

    expect(product.addStrategy(ethers.constants.AddressZero)).to.be.revertedWith("Invalid Strategy address");
    expect(product.connect(signers[1]).addStrategy(usdcStrategy.address)).to.be.revertedWith("Only dac can access");
    expect(product.addStrategy(quickStrategy.address)).to.be.revertedWith("Asset Doesn't Exist");
    expect(product.addStrategy(nonDacStrategy.address)).to.be.revertedWith("DAC conflict");

    await product.addStrategy(wmaticStrategy.address);
    expect(product.addStrategy(dupStrategy.address)).to.be.revertedWith("Strategy already exist");
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
    await utils.setProductWithAllStrategy(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

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
    await utils.setProductWithAllStrategy(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

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
    await utils.setProductWithAllStrategy(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

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
    await utils.setProductWithAllStrategy(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    // product에 돈 0원 있을 때
    expect(product.assetFloatBalance(utils.uniAddress)).to.be.revertedWith("Asset Doesn't Exist");
    expect(await product.assetFloatBalance(utils.usdcAddress)).equal(0);
    expect(await product.assetFloatBalance(utils.wmaticAddress)).equal(0);
    expect(await product.assetFloatBalance(utils.quickAddress)).equal(0);
    expect(await product.assetFloatBalance(utils.ghstAddress)).equal(0);
    expect(await product.assetFloatBalance(utils.wethAddress)).equal(0);

    expect(product.assetBalance(utils.uniAddress)).to.be.revertedWith("Asset Doesn't Exist");
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
    await utils.setProductWithAllStrategy(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(await product.portfolioValue()).equal(0);
    expect(await product.totalFloatValue()).equal(0);

    expect(product.assetValue(utils.uniAddress)).to.be.revertedWith("Asset Doesn't Exist");
    expect(await product.assetValue(utils.usdcAddress)).equal(0);
    expect(await product.assetValue(utils.wmaticAddress)).equal(0);
    expect(await product.assetValue(utils.quickAddress)).equal(0);
    expect(await product.assetValue(utils.ghstAddress)).equal(0);
    expect(await product.assetValue(utils.wethAddress)).equal(0);

    expect(product.assetFloatValue(utils.uniAddress)).to.be.revertedWith("Asset Doesn't Exist");
    expect(await product.assetFloatValue(utils.usdcAddress)).equal(0);
    expect(await product.assetFloatValue(utils.wmaticAddress)).equal(0);
    expect(await product.assetFloatValue(utils.quickAddress)).equal(0);
    expect(await product.assetFloatValue(utils.ghstAddress)).equal(0);
    expect(await product.assetFloatValue(utils.wethAddress)).equal(0);

  })

})
