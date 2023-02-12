import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Product, Strategy, UsdPriceModule } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { parseEther, parseUnits } from "ethers/lib/utils";

const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const quickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

const wmaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const wethAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const ghstAddress = "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7";
const quickAddress = "0xB5C064F955D8e7F38fE0460C556a72987494eE17";
const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

const wmaticOracle = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
const wethOracle = "0xF9680D99D6C9589e2a93a78A04A279e509205945";
const ghstOracle = "0xDD229Ce42f11D8Ee7fFf29bDB71C7b81352e11be";
const quickOracle = "0xa058689f4bCa95208bba3F265674AE95dED75B6D";
const usdcOracle = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";

const uniAddress = "0xb33EaAd8d922B1083446DC23f610c2567fB5180f"
const uniOracle = "0xdf0Fb4e4F928d2dCB76f438575fDD8682386e13C"

async function deployContracts() {
    // Deploy the contract to the test network
    const Product = await ethers.getContractFactory("Product");
    const Strategy = await ethers.getContractFactory("Strategy");
    const UsdPriceModule = await ethers.getContractFactory("UsdPriceModule");

    const [dac, nonDac] = await ethers.getSigners();

    const usdPriceModule = await UsdPriceModule.deploy();
    await usdPriceModule.deployed();

  


    /**
    /  constructor parameter list: 
    /  ProductInfo memory productInfo_
    /  address keeperRegistry_
    /  address usdPriceModule_
    /  address[] memory assetAddresses_
    /  address swapFactory_
    /  address swapRouter_ 
    /
    /  productInfo structure: 
    /  string productName;
    /  string productSymbol;
    /  string dacName;
    /  address dacAddress;
    /  address underlyingAssetAddress;
    /  uint256 floatRatio;
    /  uint256 deviationThreshold;
    */

    const productInfo = {
      productName: "Quinoa test Product",
      productSymbol: "qTEST",
      dacName: "Quinoa DAC",
      dacAddress: dac.address,
      underlyingAssetAddress: usdcAddress,
      floatRatio: 20000,
      deviationThreshold: 5000
    }

    const product = await Product.deploy(productInfo, usdPriceModule.address, usdPriceModule.address, [wmaticAddress, wethAddress], quickSwapFactory, quickSwapRouter);
    await product.deployed();

    const wmaticStrategy = await Strategy.deploy(dac.address, wmaticAddress, product.address);
    await wmaticStrategy.deployed();
    const wethStrategy = await Strategy.deploy(dac.address, wethAddress, product.address);
    await wethStrategy.deployed();
    const ghstStrategy = await Strategy.deploy(dac.address, ghstAddress, product.address);
    await ghstStrategy.deployed();
    const quickStrategy = await Strategy.deploy(dac.address, quickAddress, product.address);await usdPriceModule.deployed();
    await quickStrategy.deployed();
    const usdcStrategy = await Strategy.deploy(dac.address, usdcAddress, product.address);
    await usdcStrategy.deployed();

    // non dac member depoly bad strategy 1
    const nonDacStrategy = await Strategy.connect(nonDac).deploy(nonDac.address, wmaticAddress, product.address);
    await nonDacStrategy.deployed();
    // bad strategy 2 uses uni token that product doesn't use
    const diffAssetStrategy = await Strategy.deploy(dac.address, uniAddress, product.address);
    await diffAssetStrategy.deployed();
    // bad strategy 3 is duplicated strategy with wmaticStrategy
    const dupStrategy = await Strategy.deploy(dac.address, wmaticAddress, product.address)
    await dupStrategy.deployed();

    return {
      dac, nonDac,
      product, wmaticStrategy,
      wethStrategy, ghstStrategy,
      quickStrategy, usdcStrategy,
      usdPriceModule,
      nonDacStrategy, diffAssetStrategy, dupStrategy
    };
}

async function setUsdPriceModule(usdPriceModule: UsdPriceModule) {
  await usdPriceModule.addUsdPriceFeed(wmaticAddress, wmaticOracle);
  await usdPriceModule.addUsdPriceFeed(wethAddress, wethOracle);
  await usdPriceModule.addUsdPriceFeed(ghstAddress, ghstOracle);
  await usdPriceModule.addUsdPriceFeed(quickAddress, quickOracle);
  await usdPriceModule.addUsdPriceFeed(usdcAddress, usdcOracle);
  await usdPriceModule.addUsdPriceFeed(uniAddress, uniOracle);
}

async function setProduct(
  product: Product,
  wmaticStrategy: Strategy,
   wethStrategy: Strategy,
   ghstStrategy: Strategy,
   quickStrategy: Strategy,
   usdcStrategy: Strategy
   )
{
  // 나머지 asset add
  await product.addAsset(ghstAddress);
  await product.addAsset(quickAddress);

  // strategy add
  await product.addStrategy(wmaticStrategy.address);
  await product.addStrategy(ghstStrategy.address);
  await product.addStrategy(quickStrategy.address);
  await product.addStrategy(wethStrategy.address);
  await product.addStrategy(usdcStrategy.address);

  // update weight 해서 원하는 weight까지
  product.updateWeight([usdcAddress, ghstAddress, wmaticAddress, wethAddress, quickAddress], [30000, 5000, 40000, 20000, 5000]);

  // withdrawal queue update
  await product.updateWithdrawalQueue([wmaticStrategy.address, wethStrategy.address, usdcStrategy.address, ghstStrategy.address, quickStrategy.address]);

}

// Test 완료
describe('Product Depoly Test', () => {

  it('Contacts deploy test', async () => {
    const {product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy, usdPriceModule, nonDacStrategy, diffAssetStrategy, dupStrategy} = await deployContracts();

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
    const {
      dac, product,
      usdPriceModule,
    } = await deployContracts();

    // Product test
    // currnet asset list 확인
    expect(await product.checkAsset(wmaticAddress)).equal(true);
    expect(await product.checkAsset(wethAddress)).equal(true);
    expect(await product.checkAsset(ghstAddress)).equal(false);
    expect(await product.checkAsset(quickAddress)).equal(false);
    expect(await product.checkAsset(usdcAddress)).equal(true);
    expect(await product.checkAsset(uniAddress)).equal(false);

    // dac information 확인
    expect(await product.dacName()).equal("Quinoa DAC");
    expect(await product.dacAddress()).equal(dac.address);

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
    const {
      product,
      wmaticStrategy,
      wethStrategy,
      usdcStrategy,
      ghstStrategy,
      quickStrategy,
    } = await deployContracts();

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
    const {
      dac, nonDac, product,
      wmaticStrategy,
      wethStrategy,
      usdcStrategy,
      ghstStrategy,
      quickStrategy,
      diffAssetStrategy,
      nonDacStrategy,
      dupStrategy
    } = await deployContracts();

    // Strategy test
    // dac nondac 잘 세팅되었는지 확인
    expect(await wmaticStrategy.dacAddress()).equal(dac.address);
    expect(await wethStrategy.dacAddress()).equal(dac.address);
    expect(await ghstStrategy.dacAddress()).equal(dac.address);
    expect(await quickStrategy.dacAddress()).equal(dac.address);
    expect(await usdcStrategy.dacAddress()).equal(dac.address);
    expect(await diffAssetStrategy.dacAddress()).equal(dac.address);
    expect(await nonDacStrategy.dacAddress()).equal(nonDac.address);
    expect(await dupStrategy.dacAddress()).equal(dac.address);
  })

});

describe('Contract setting test', () => {
  // constract를 실제 사용하기 전까지 잘 작동 세팅 되어 있는지 확인

  it('UsdPriceModule setting test', async() => {
    const {usdPriceModule} = await deployContracts();
    await setUsdPriceModule(usdPriceModule);

    expect (await usdPriceModule.getUsdPriceFeed(wmaticAddress)).equal(wmaticOracle);
    expect (await usdPriceModule.getUsdPriceFeed(wethAddress)).equal(wethOracle);
    expect (await usdPriceModule.getUsdPriceFeed(ghstAddress)).equal(ghstOracle);
    expect (await usdPriceModule.getUsdPriceFeed(quickAddress)).equal(quickOracle);
    expect (await usdPriceModule.getUsdPriceFeed(usdcAddress)).equal(usdcOracle);
    expect (await usdPriceModule.getUsdPriceFeed(uniAddress)).equal(uniOracle);

    // oracle 가격 잘 불러와지는지 확인
    console.log("wmatic current price: ", await usdPriceModule.getAssetUsdPrice(wmaticAddress));
    console.log("weth current price: ", await usdPriceModule.getAssetUsdPrice(wethAddress));
    console.log("ghst current price: ", await usdPriceModule.getAssetUsdPrice(ghstAddress));
    console.log("quick current price: ", await usdPriceModule.getAssetUsdPrice(quickAddress));
    console.log("usdc current price: ", await usdPriceModule.getAssetUsdPrice(usdcAddress));
    console.log("uni current price: ", await usdPriceModule.getAssetUsdPrice(uniAddress));
  })

  it('Product setting',async () => {
    // 실제 product를 운용하기 전에, 각각의 값들이 잘 세팅되고 잘 변화하는지 확인
    const {
      product, wmaticStrategy,
      wethStrategy, ghstStrategy,
      quickStrategy, usdcStrategy,
    } = await deployContracts();

    // add asset 잘 되는지 test
    await product.addAsset(ghstAddress);
    await product.addAsset(quickAddress);
    expect(await product.checkAsset(wmaticAddress)).equal(true);
    expect(await product.checkAsset(wethAddress)).equal(true);
    expect(await product.checkAsset(ghstAddress)).equal(true);
    expect(await product.checkAsset(quickAddress)).equal(true);
    expect(await product.checkAsset(usdcAddress)).equal(true);
    expect(await product.checkAsset(uniAddress)).equal(false);

    // // weight 잘 들어가는지 test
    // console.log(await product.currentAssets());
    // tickers = {'MATIC':0.4, 'ETH': 0.2, 'GHST': 0.05, 'QUICK':0.05, 'USDC': 0.3}
    await product.updateWeight([usdcAddress, ghstAddress, wmaticAddress, wethAddress, quickAddress], [30000, 5000, 40000, 20000, 5000]);
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
    const {
      nonDac,
      product, wmaticStrategy,
      wethStrategy, ghstStrategy,
      quickStrategy, usdcStrategy,
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.updateUsdPriceModule(ethers.constants.AddressZero)).to.be.revertedWith('Invalid USD price module');
    expect(product.updateUsdPriceModule(usdPriceModule.address)).to.be.revertedWith('Duplicated Vaule input');
    expect(product.connect(nonDac).updateUsdPriceModule(ethers.constants.AddressZero)).to.be.revertedWith('Only dac can access');
    await product.updateUsdPriceModule(nonDac.address);
    expect(await product.currentUsdPriceModule()).equal(nonDac.address);
  })

  it('updateFloatRatio test', async() => {
    const {
      nonDac,
      product, wmaticStrategy,
      wethStrategy, ghstStrategy,
      quickStrategy, usdcStrategy
    } = await deployContracts();
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.updateFloatRatio(100000000000)).to.be.revertedWith("Invalid float ratio");
    expect(product.updateFloatRatio(-3)).to.be.revertedWith("Invalid float ratio");
    expect(product.updateFloatRatio(20000)).to.be.revertedWith('Duplicated Vaule input');
    expect(product.connect(nonDac).updateFloatRatio(15000)).to.be.revertedWith('Only dac can access');
    await product.updateFloatRatio(15000);
    expect(await product.currentFloatRatio()).equal(15000);
  })

  it('updateDeviationThreshold test', async() => {
    const {
      nonDac,
      product, wmaticStrategy,
      wethStrategy, ghstStrategy,
      quickStrategy, usdcStrategy
    } = await deployContracts();
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.updateDeviationThreshold(100000000000)).to.be.revertedWith("Invalid Rebalance Threshold");
    expect(product.updateDeviationThreshold(-3)).to.be.revertedWith("Invalid Rebalance Threshold");
    expect(product.updateDeviationThreshold(5000)).to.be.revertedWith('Duplicated Vaule input');
    expect(product.connect(nonDac).updateDeviationThreshold(3000)).to.be.revertedWith('Only dac can access');
    await product.updateDeviationThreshold(3000);
    expect(await product.currentDeviationThreshold()).equal(3000);
  })

  it('updateWithdrawalQueue test', async() => {
    const {
      nonDac,
      product, wmaticStrategy,
      wethStrategy, ghstStrategy,
      quickStrategy, usdcStrategy
    } = await deployContracts();

    expect(product.connect(nonDac).updateWithdrawalQueue([wethStrategy.address, usdcStrategy.address])).to.be.revertedWith('Only dac can access');
    expect(product.updateWithdrawalQueue([wmaticStrategy.address, wethStrategy.address, usdcStrategy.address, ghstStrategy.address, quickStrategy.address])).to.be.revertedWith('Too many elements');
    expect(product.updateWithdrawalQueue([quickStrategy.address])).to.be.revertedWith("Strategy doesn't exist");

    // console.log(await product.currentWithdrawalQueue());
    await product.addAsset(ghstAddress);
    await product.addAsset(quickAddress);
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
    const {
      nonDac, product
    } = await deployContracts();

    expect(product.connect(nonDac).updateWeight([usdcAddress,wmaticAddress, wethAddress], [30000, 40000, 30000])).to.be.revertedWith('Only dac can access');
    expect(product.updateWeight([usdcAddress, wethAddress], [30000, 40000, 30000])).to.be.revertedWith('Invalid weight pair');
    expect(product.updateWeight([usdcAddress, ghstAddress, wmaticAddress, wethAddress, quickAddress], [30000, 5000, 40000, 20000, 5000])).to.be.revertedWith('Asset not found');
    expect(product.updateWeight([usdcAddress,wmaticAddress, wethAddress], [130000, 140000, 130000])).to.be.revertedWith('Invalid asset target weight');
    expect(product.updateWeight([usdcAddress,wmaticAddress, wethAddress], [40000, 40000, 40000])).to.be.revertedWith('Sum of asset weights is not 100%');
    expect(product.updateWeight([usdcAddress,wmaticAddress, wethAddress], [30000, 30000, 30000])).to.be.revertedWith('Sum of asset weights is not 100%');

    console.log(await product.currentAssets());
    await product.updateWeight([usdcAddress,wmaticAddress, wethAddress], [30000, 40000, 30000]);
    console.log(await product.currentAssets());
  })

})

describe('Product add functions test', () => {
  //product의 update function들 잘 작동하는지 확인

  it('addAsset test', async() => {
    const {
      nonDac, product
    } = await deployContracts();
    // await setUsdPriceModule(usdPriceModule);
    // await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.addAsset(ethers.constants.AddressZero)).to.be.revertedWith("Invalid asset address");
    expect(product.addAsset(usdcAddress)).to.be.revertedWith("Asset Already Exists");
    expect(product.connect(nonDac).addAsset(usdcAddress)).to.be.revertedWith("Only dac can access");
  })

  it('addStrategy test', async() => {
    const {
      nonDac,
      product, wmaticStrategy,
      quickStrategy, usdcStrategy,
      nonDacStrategy, dupStrategy
    } = await deployContracts();
    //await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(product.addStrategy(ethers.constants.AddressZero)).to.be.revertedWith("Invalid Strategy address");
    expect(product.connect(nonDac).addStrategy(usdcStrategy.address)).to.be.revertedWith("Only dac can access");
    expect(product.addStrategy(quickStrategy.address)).to.be.revertedWith("Asset Doesn't Exist");
    expect(product.addStrategy(nonDacStrategy.address)).to.be.revertedWith("DAC conflict");

    await product.addStrategy(wmaticStrategy.address);
    expect(product.addStrategy(dupStrategy.address)).to.be.revertedWith("Strategy already exist");
  })

})

describe('Product balance/price functions test', () => {
  // product의 price 와 balance 관련 function들 잘 작동하는지 확인

  it('maxDeposit test', async() => {
    const {
      dac, nonDac, product
    } = await deployContracts();

    expect(await product.maxDepositValue(dac.address)).equal(ethers.constants.MaxUint256);
    expect(await product.maxDepositValue(nonDac.address)).equal(55000000000000000000n);
  })

  it('maxWithdrawValue test', async() => {
    const {
      dac, nonDac, product
    } = await deployContracts();

    expect(await product.maxWithdrawValue(dac.address)).equal(0);
    expect(await product.maxWithdrawValue(nonDac.address)).equal(0);
  })

  it('convertToShare test', async () => {
    const {
      product, wmaticStrategy,
      wethStrategy, ghstStrategy,
      quickStrategy, usdcStrategy,
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    let wmaticPrice = (await usdPriceModule.getAssetUsdPrice(wmaticAddress)).toString();
    let usdcPrice = (await usdPriceModule.getAssetUsdPrice(usdcAddress)).toString();

    expect(((await product.convertToShares(wmaticAddress, ethers.utils.parseUnits("100.0", 18)))).toString()).equal(wmaticPrice + '00');
    expect((await product.convertToShares(usdcAddress, ethers.utils.parseUnits("10.0", 6))).toString()).equal(usdcPrice + '0');

  })

  it('convertToAsset test', async () => {
    const {
      product, wmaticStrategy,
      wethStrategy, ghstStrategy,
      quickStrategy, usdcStrategy,
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    let wmaticPrice = (await usdPriceModule.getAssetUsdPrice(wmaticAddress));
    let usdcPrice = (await usdPriceModule.getAssetUsdPrice(usdcAddress));

    expect(((await product.convertToAssets(wmaticAddress, wmaticPrice.mul(100))).toString())).equal(parseEther("100"));
    expect(((await product.convertToAssets(usdcAddress, usdcPrice.mul(1000))).toString())).equal(parseUnits("1000", 6));

  })

  it('sharePrice & shareValue test', async () => {
    const {
      product, wmaticStrategy,
      wethStrategy, ghstStrategy,
      quickStrategy, usdcStrategy,
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    // product에 0원 있을 때
    expect(await product.sharePrice()).equal(ethers.utils.parseUnits("1.0", 18));
    expect(await product.shareValue(ethers.utils.parseUnits("100000.0", 18))).equal(ethers.utils.parseUnits("100000.0", 18));
    expect(await product.shareValue(ethers.utils.parseUnits("1342934.0", 18))).equal(ethers.utils.parseUnits("1342934.0", 18));

    // product에 돈이 있을 때 → matic을 wMatic으로 바꾸어야 하는데 ..흐음
    // await product.deposit(wmaticAddress, ethers.utils.parseUnits("200.0", 6), dac.address);

  })

  it('balance function test', async () => {
    const {
      product, wmaticStrategy,
      wethStrategy, ghstStrategy,
      quickStrategy, usdcStrategy,
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    // product에 돈 0원 있을 때
    expect(product.assetFloatBalance(uniAddress)).to.be.revertedWith("Asset Doesn't Exist");
    expect(await product.assetFloatBalance(usdcAddress)).equal(0);
    expect(await product.assetFloatBalance(wmaticAddress)).equal(0);
    expect(await product.assetFloatBalance(quickAddress)).equal(0);
    expect(await product.assetFloatBalance(ghstAddress)).equal(0);
    expect(await product.assetFloatBalance(wethAddress)).equal(0);

    expect(product.assetBalance(uniAddress)).to.be.revertedWith("Asset Doesn't Exist");
    expect(await product.assetBalance(usdcAddress)).equal(0);
    expect(await product.assetBalance(wmaticAddress)).equal(0);
    expect(await product.assetBalance(quickAddress)).equal(0);
    expect(await product.assetBalance(ghstAddress)).equal(0);
    expect(await product.assetBalance(wethAddress)).equal(0);
  })

  it('value function test', async () => {
    const {
      product, wmaticStrategy,
      wethStrategy, ghstStrategy,
      quickStrategy, usdcStrategy,
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

    expect(await product.portfolioValue()).equal(0);
    expect(await product.totalFloatValue()).equal(0);

    expect(product.assetValue(uniAddress)).to.be.revertedWith("Asset Doesn't Exist");
    expect(await product.assetValue(usdcAddress)).equal(0);
    expect(await product.assetValue(wmaticAddress)).equal(0);
    expect(await product.assetValue(quickAddress)).equal(0);
    expect(await product.assetValue(ghstAddress)).equal(0);
    expect(await product.assetValue(wethAddress)).equal(0);

    expect(product.assetFloatValue(uniAddress)).to.be.revertedWith("Asset Doesn't Exist");
    expect(await product.assetFloatValue(usdcAddress)).equal(0);
    expect(await product.assetFloatValue(wmaticAddress)).equal(0);
    expect(await product.assetFloatValue(quickAddress)).equal(0);
    expect(await product.assetFloatValue(ghstAddress)).equal(0);
    expect(await product.assetFloatValue(wethAddress)).equal(0);

  })

})
