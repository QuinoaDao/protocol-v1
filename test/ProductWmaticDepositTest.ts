import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract, utils } from "ethers";
import { Product, Strategy, UsdPriceModule, ERC20 } from "../typechain-types";

import wMaticAbi from "../abis/wMaticABI.json";
import usdcAbi from "../abis/usdcABI.json";
import wEthAbi from "../abis/wEthABI.json";
import quickAbi from "../abis/quickABI.json";
import ghstAbi from "../abis/ghstABI.json";
import quickSwapAbi from "../abis/quickSwapABI.json";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { days } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";

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

const uniAddress = "0xb33EaAd8d922B1083446DC23f610c2567fB5180f";
const uniOracle = "0xdf0Fb4e4F928d2dCB76f438575fDD8682386e13C";

async function deployContracts() {
  // Deploy the contract to the test network
  const Product = await ethers.getContractFactory("Product");
  const Strategy = await ethers.getContractFactory("Strategy");
  const UsdPriceModule = await ethers.getContractFactory("UsdPriceModule");

  const [dac, nonDac] = await ethers.getSigners();

  const usdPriceModule = await UsdPriceModule.deploy();
  await usdPriceModule.deployed();

  const product = await Product.deploy(
    "Quinoa test Product",
    "qTEST",
    dac.address,
    "Quinoa DAC",
    usdPriceModule.address,
    usdcAddress,
    [wmaticAddress, wethAddress],
    20000,
    5000,
    quickSwapFactory,
    quickSwapRouter
  );
  await product.deployed();

  const wmaticStrategy = await Strategy.deploy(wmaticAddress, product.address);
  await wmaticStrategy.deployed();
  const wethStrategy = await Strategy.deploy(wethAddress, product.address);
  await wethStrategy.deployed();
  const ghstStrategy = await Strategy.deploy(ghstAddress, product.address);
  await ghstStrategy.deployed();
  const quickStrategy = await Strategy.deploy(quickAddress, product.address);
  await usdPriceModule.deployed();
  await quickStrategy.deployed();
  const usdcStrategy = await Strategy.deploy(usdcAddress, product.address);
  await usdcStrategy.deployed();

  // non dac member depoly bad strategy 1
  const nonDacStrategy = await Strategy.connect(nonDac).deploy(
    wmaticAddress,
    product.address
  );
  await nonDacStrategy.deployed();
  // bad strategy 2 uses uni token that product doesn't use
  const diffAssetStrategy = await Strategy.deploy(uniAddress, product.address);
  await diffAssetStrategy.deployed();
  // bad strategy 3 is duplicated strategy with wmaticStrategy
  const dupStrategy = await Strategy.deploy(wmaticAddress, product.address);
  await dupStrategy.deployed();

  return {
    dac,
    nonDac,
    product,
    wmaticStrategy,
    wethStrategy,
    ghstStrategy,
    quickStrategy,
    usdcStrategy,
    usdPriceModule,
    nonDacStrategy,
    diffAssetStrategy,
    dupStrategy,
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
) {
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
  await product.updateWeight(
    [usdcAddress, ghstAddress, wmaticAddress, wethAddress, quickAddress],
    [30000, 5000, 40000, 20000, 5000]
  );

  // withdrawal queue update
  await product.updateWithdrawalQueue([
    wmaticStrategy.address,
    wethStrategy.address,
    usdcStrategy.address,
    ghstStrategy.address,
    quickStrategy.address,
  ]);
}

async function getTokens(dac: SignerWithAddress, nonDac: SignerWithAddress) {
  const wMaticContract = new ethers.Contract(wmaticAddress, wMaticAbi, dac);
  const wEthContract = new ethers.Contract(wethAddress, wEthAbi, dac);
  const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, dac);
  const quickContract = new ethers.Contract(quickAddress, quickAbi, dac);
  const ghstContract = new ethers.Contract(ghstAddress, ghstAbi, dac);

  if((await wMaticContract.balanceOf(dac.address)).toString() == "0"){
    await wMaticContract.deposit({
      from: dac.address,
      value: ethers.utils.parseEther("1000"),
      gasLimit: 59999,
    });
  }

  if((await wMaticContract.balanceOf(nonDac.address)).toString() == "0"){
    await wMaticContract.connect(nonDac).deposit({
      from: nonDac.address,
      value: ethers.utils.parseEther("1000"),
      gasLimit: 59999,
    });
  }

  return {
    wMaticContract,
    wEthContract,
    usdcContract,
    quickContract,
    ghstContract
  };
}

async function activateProduct(dac: SignerWithAddress, product: Product, wMaticContract: Contract) {
  await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
  await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("200"), dac.address);
  await product.activateProduct();
}


describe('matic - wmatic test',async () => {
    it('matic - wmatic convert',async () => {
        const {
            dac, nonDac, 
            product, wmaticStrategy, 
            wethStrategy, ghstStrategy, 
            quickStrategy, usdcStrategy, 
            usdPriceModule,
            nonDacStrategy, diffAssetStrategy, dupStrategy
        } = await deployContracts();
        await setUsdPriceModule(usdPriceModule);
        await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
        const wMaticContract = new ethers.Contract(wmaticAddress, wMaticAbi, dac);
        
        console.log("Before dac matic balance: ", await dac.getBalance());
        console.log("Before dac wMatic balance: ", await wMaticContract.balanceOf(dac.address))
        expect((await wMaticContract.balanceOf(dac.address)).toString()).equal("0");
        await wMaticContract.deposit({from: dac.address, value: ethers.utils.parseEther("1000"), gasLimit: 59999});
        console.log("Before dac matic balance: ", await dac.getBalance());
        console.log("Before dac wMatic balance: ", await wMaticContract.balanceOf(dac.address))
        expect((await wMaticContract.balanceOf(dac.address)).toString()).equal((ethers.utils.parseEther("1000")).toString());
    })
})


describe('activation test',async () => {
   // 이때, activateProduct -> onlyDac check, 설정이 다 안되어 있을 때 activate 안되는거 확인
  it('Product activation failuer test',async () => {
    const {
      dac, nonDac,
      wmaticStrategy, 
      wethStrategy, ghstStrategy, 
      quickStrategy, usdcStrategy, 
      usdPriceModule,
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    const {wMaticContract} =await getTokens(dac, nonDac);

    const Product = await ethers.getContractFactory("Product");
    const product = await Product.deploy(
      "Quinoa test Product", // name
      "qTEST", // symbol
      dac.address, // dac address
      "Quinoa DAC", // dac name
      usdPriceModule.address, // usd price module
      usdcAddress, // underlying assets address
      [wmaticAddress, wethAddress], // assets
      20000, // float ratio
      5000, // deviation threashold
      quickSwapFactory, // swap factory
      quickSwapRouter // swap router
    );
    await product.deployed();

    // 세팅 불가 항목 list

    // strategy가 맞게 존재하는지 확인
    await product.addAsset(ghstAddress);
    await product.addAsset(quickAddress);
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
      [usdcAddress, ghstAddress, wmaticAddress, wethAddress, quickAddress],
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
    await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    // dac이 아닌 사람은 activate 불가능
    expect(product.connect(nonDac).activateProduct()).revertedWith("Only dac can access");
    // 이미 activation 상태라면 activate 불가능
    await product.activateProduct();
    expect(product.activateProduct()).revertedWith("Already activation state");

  })

  // dac이 200 달러 이상으로 입금한 경우 : wmatic in - wmatic out -> acitvation 확인
  it('Product activation test',async () => {
    const {
      dac, nonDac,
      product, wmaticStrategy, 
      wethStrategy, ghstStrategy, 
      quickStrategy, usdcStrategy, 
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
    const {wMaticContract, wEthContract, usdcContract, quickContract, ghstContract } =await getTokens(dac, nonDac);

    console.log("Dac wmatic balance: ", await wMaticContract.balanceOf(dac.address));
    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    console.log("Dac wmatic balance: ", await wMaticContract.balanceOf(dac.address));

    expect(await product.checkActivation()).equal(false);
    await product.activateProduct();
    expect(await product.checkActivation()).equal(true);
  })

})


describe('Basic deposit test',async () => {

  it('deposit failure test: deactivation status',async () => {
    const {
      dac, nonDac, 
      product, wmaticStrategy, 
      wethStrategy, ghstStrategy, 
      quickStrategy, usdcStrategy, 
      usdPriceModule,
      nonDacStrategy, diffAssetStrategy, dupStrategy
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
  
    expect(product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("100"), dac.address)).revertedWith("Deposit is disabled now");
  })

  it('wmatic in - wmatic out test: only dac',async () => {
    const {
      dac, nonDac, 
      product, wmaticStrategy, 
      wethStrategy, ghstStrategy, 
      quickStrategy, usdcStrategy, 
      usdPriceModule,
      nonDacStrategy, diffAssetStrategy, dupStrategy
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
    const {wMaticContract, wEthContract, usdcContract, quickContract, ghstContract } =await getTokens(dac, nonDac);
  
    let wMaticBalance = await wMaticContract.balanceOf(dac.address);
    let wMaticValue_100 = await usdPriceModule.getAssetUsdValue(wmaticAddress, ethers.utils.parseEther("100"));

    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("100"));
    await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("100"), dac.address);

    expect(await product.portfolioValue()).equal(wMaticValue_100)
    expect(await wMaticContract.balanceOf(dac.address)).equal(wMaticBalance.sub(ethers.utils.parseEther("100")));
    expect(await product.totalSupply()).equal(wMaticValue_100);
    expect(await product.sharePrice()).equal(ethers.utils.parseEther("1"));
    expect(await product.balanceOf(dac.address)).equal(wMaticValue_100);

    await product.connect(dac).withdraw(wmaticAddress, ethers.utils.parseEther("123.1"), dac.address, dac.address);
    expect((await product.portfolioValue()).toString()).equal("0");
    expect(await wMaticContract.balanceOf(dac.address)).equal(wMaticBalance);
    expect((await product.totalSupply()).toString()).equal("0");
    expect(await product.sharePrice()).equal(ethers.utils.parseEther("1"));
    expect((await product.balanceOf(dac.address)).toString()).equal("0");
  })

  // wmatic in - wmatic out -> activation + nonDac 제한 확인
  it('wmatic in - wmatic out test: nonDac maxDeposit',async () => {
    const {
      dac, nonDac,
      product, wmaticStrategy, 
      wethStrategy, ghstStrategy, 
      quickStrategy, usdcStrategy, 
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
    const {wMaticContract} =await getTokens(dac, nonDac);

    // console.log("before deposit, dac wmatic balance: ", await wMaticContract.balanceOf(dac.address));
    // console.log("before deposit, nonDac wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));
    // console.log("before total supply: ", await product.totalSupply()); 

    let dacDepositValue = await usdPriceModule.getAssetUsdValue(wmaticAddress, ethers.utils.parseEther("200"));
    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    await product.activateProduct();
    // console.log("after deposit, dac wmatic balance: ", await wMaticContract.balanceOf(dac.address));
    // console.log("after dac deposit total supply: ", await product.totalSupply());

    // nonDac이 55 달러 이상 낸다고 햇을 때 -> 거절
    let nonDacDepositValue = await usdPriceModule.getAssetUsdValue(wmaticAddress, ethers.utils.parseEther("100"));
    await wMaticContract.connect(nonDac).approve(product.address, ethers.utils.parseEther("100"));
    expect(product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("100"), nonDac.address)).revertedWith("Too much deposit");

    // nonDac이 55 달러 이하 낸다고 했을 때 -> 승인
    nonDacDepositValue = await usdPriceModule.getAssetUsdValue(wmaticAddress, ethers.utils.parseEther("30"));
    expect(await product.connect(nonDac).callStatic.deposit(wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)).equal(nonDacDepositValue);
    await product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("30"), nonDac.address);
    // console.log("after deposit, nonDac wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));
    // console.log("after nonDac deposit total supply: ", await product.totalSupply());
    // console.log("after nonDac depoist, balance of sharetoken: ", await product.balanceOf(nonDac.address));

    // console.log("dacDepositValue: ", dacDepositValue);
    // console.log("nonDacDepositValue: ", nonDacDepositValue);
    // console.log("portfolioValue: ", await product.portfolioValue());
    // console.log("sharePrice: ", await product.sharePrice())
    // console.log("dac maxWithdrawValue: ", await product.maxWithdrawValue(dac.address));
    // console.log("nonDac maxWithdrawValue", await product.maxWithdrawValue(nonDac.address));

    expect(await product.portfolioValue()).equal(dacDepositValue.add(nonDacDepositValue));
    expect(await product.sharePrice()).equal(utils.parseEther("1"));
    expect(await product.maxWithdrawValue(dac.address)).equal(dacDepositValue);
    expect(await product.maxWithdrawValue(nonDac.address)).equal(nonDacDepositValue)

  }) 

  // wmatic in - wmatic out -> actibation(checkActivation) -> dac + nonDac -> withdraw test
  it('wmatic in - wmatic out: nonDac withdraw test',async () => {
    const {
      dac, nonDac,
      product, wmaticStrategy, 
      wethStrategy, ghstStrategy, 
      quickStrategy, usdcStrategy, 
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
    const {wMaticContract} =await getTokens(dac, nonDac);

    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    await product.activateProduct();

    let nonDaoWmaticBalance = await wMaticContract.balanceOf(nonDac.address);
    await wMaticContract.connect(nonDac).approve(product.address, ethers.utils.parseEther("100"));
    await product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)
    await product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)
    await product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)

    let nonDacDepositValue = await usdPriceModule.getAssetUsdValue(wmaticAddress, parseEther("90"));
    expect(await wMaticContract.balanceOf(nonDac.address)).equal(nonDaoWmaticBalance.sub(parseEther("90")));
    expect(await product.balanceOf(nonDac.address)).equal(nonDacDepositValue);
    expect(await product.shareValue(await product.balanceOf(nonDac.address))).equal(nonDacDepositValue);
    expect(await product.convertToAssets(wmaticAddress, await product.balanceOf(nonDac.address))).equal(parseEther("90"));
    expect(await product.convertToAssets(wmaticAddress, await product.totalSupply())).equal(parseEther("290"));

    let nonDacWithdrawValue = await usdPriceModule.getAssetUsdValue(wmaticAddress, parseEther("50"));
    let nonDacWithdrawalShreBalance = await product.convertToShares(wmaticAddress, parseEther("50"));
    expect(await product.maxWithdrawValue(nonDac.address)).equal(nonDacDepositValue);
    expect(product.connect(dac).withdraw(wmaticAddress, ethers.constants.MaxUint256, dac.address, dac.address)).revertedWith("Withdrawal is disabled now");
    await product.connect(nonDac).withdraw(wmaticAddress, nonDacWithdrawalShreBalance, nonDac.address, nonDac.address);

    expect(await wMaticContract.balanceOf(nonDac.address)).equal(nonDaoWmaticBalance.sub(parseEther("40")));
    expect(await product.balanceOf(nonDac.address)).equal(nonDacDepositValue.sub(nonDacWithdrawValue));
    expect(await product.shareValue(await product.balanceOf(nonDac.address))).equal(nonDacDepositValue.sub(nonDacWithdrawValue));
    expect(await product.convertToAssets(wmaticAddress, await product.balanceOf(nonDac.address))).equal(parseEther("40"));
    expect(await product.convertToAssets(wmaticAddress, await product.totalSupply())).equal(parseEther("240"));
  })

  // wamtic in - wmatic out -> activation(checkActivation) -> dac + onnDac -> maxWithdraw test
  it('wmatic in - wmatic out: nonDac max withdraw test',async () => {
    const {
      dac, nonDac,
      product, wmaticStrategy, 
      wethStrategy, ghstStrategy, 
      quickStrategy, usdcStrategy, 
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
    const {wMaticContract} =await getTokens(dac, nonDac);

    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    await product.activateProduct();

    let nonDaoWmaticBalance = await wMaticContract.balanceOf(nonDac.address);
    await wMaticContract.connect(nonDac).approve(product.address, ethers.utils.parseEther("100"));
    await product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)
    await product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)
    await product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)

    let nonDacDepositValue = await usdPriceModule.getAssetUsdValue(wmaticAddress, parseEther("90"));
    expect(await wMaticContract.balanceOf(nonDac.address)).equal(nonDaoWmaticBalance.sub(parseEther("90")));
    expect(await product.balanceOf(nonDac.address)).equal(nonDacDepositValue);
    expect(await product.shareValue(await product.balanceOf(nonDac.address))).equal(nonDacDepositValue);
    expect(await product.convertToAssets(wmaticAddress, await product.balanceOf(nonDac.address))).equal(parseEther("90"));
    expect(await product.convertToAssets(wmaticAddress, await product.totalSupply())).equal(parseEther("290"));

    let dacDepositValue = await usdPriceModule.getAssetUsdValue(wmaticAddress, parseEther("200"));
    expect(await product.maxWithdrawValue(nonDac.address)).equal(nonDacDepositValue);
    await product.connect(nonDac).withdraw(wmaticAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);

    expect(await wMaticContract.balanceOf(nonDac.address)).equal(nonDaoWmaticBalance);
    expect(await product.balanceOf(nonDac.address)).equal(parseEther("0"));
    expect(await product.shareValue(await product.balanceOf(nonDac.address))).equal(parseEther("0"));
    expect(await product.totalSupply()).equal(dacDepositValue)
    expect(await product.convertToAssets(wmaticAddress, await product.balanceOf(nonDac.address))).equal(parseEther("0"));
    expect(await product.convertToAssets(wmaticAddress, await product.totalSupply())).equal(parseEther("200"));
  })
})
 

describe('decimal 18 in-out',async () => {
  it('wmatic in - weth out',async () => {
    const {
      dac, nonDac,
      product, wmaticStrategy, 
      wethStrategy, ghstStrategy, 
      quickStrategy, usdcStrategy, 
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
    const {wMaticContract, wEthContract} =await getTokens(dac, nonDac);
    await activateProduct(dac, product, wMaticContract);

    // wmatic으로 30 token deposit
    await wMaticContract.connect(nonDac).approve(product.address, ethers.utils.parseEther("100"));
    await product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("30"), nonDac.address) // wmatic deposit

    console.log("wmatic 30개 value: ", await usdPriceModule.getAssetUsdValue(wmaticAddress, parseEther("30")));
    console.log("유저의 share token 개수: ", await product.balanceOf(nonDac.address));
    console.log("product의 total supply: ", await product.totalSupply());
    console.log("product의 wmatic balance: ", await wMaticContract.balanceOf(product.address));
    console.log("value -> wmatic asset amouont: ", await product.convertToAssets(wmaticAddress, await product.balanceOf(nonDac.address)));
    console.log("value -> weth asset amouont: ", await product.convertToAssets(wethAddress, await product.balanceOf(nonDac.address)));

    // weth로 전부 withdraw
    await product.connect(nonDac).withdraw(wethAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
    console.log("nonDac withdraw value: ", await usdPriceModule.getAssetUsdValue(wethAddress, await wEthContract.balanceOf(nonDac.address)));
    console.log("유저의 share token 개수: ", await product.balanceOf(nonDac.address));
    console.log("product의 total supply: ", await product.totalSupply());
    console.log("product의 wmatic balance: ", await wMaticContract.balanceOf(product.address));
    console.log("유저의 weth 개수: ", await wEthContract.balanceOf(nonDac.address));
    
    await product.deactivateProduct();
    await product.withdraw(wmaticAddress, ethers.constants.MaxUint256, dac.address, dac.address);
    console.log("product의 total supply: ", await product.totalSupply());
    console.log("product의 wmatic balance: ", await wMaticContract.balanceOf(product.address));
    console.log("dac의 wmatic 개수: ", await wMaticContract.balanceOf(dac.address));
  })
})

describe('wmatic in - quick out',async () => {
  it('wmatic in - quick out',async () => {
    const {
      dac, nonDac,
      product, wmaticStrategy, 
      wethStrategy, ghstStrategy, 
      quickStrategy, usdcStrategy, 
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
    const {wMaticContract, quickContract} =await getTokens(dac, nonDac);
    await activateProduct(dac, product, wMaticContract);

    // wmatic으로 30 token deposit
    await wMaticContract.connect(nonDac).approve(product.address, ethers.utils.parseEther("100"));
    await product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("30"), nonDac.address) // wmatic deposit

    console.log("wmatic 30개 value: ", await usdPriceModule.getAssetUsdValue(wmaticAddress, parseEther("30")));
    console.log("유저의 share token 개수: ", await product.balanceOf(nonDac.address));
    console.log("product의 total supply: ", await product.totalSupply());
    console.log("product의 wmatic balance: ", await wMaticContract.balanceOf(product.address));
    console.log("value -> wmatic asset amouont: ", await product.convertToAssets(wmaticAddress, await product.balanceOf(nonDac.address)));
    console.log("value -> quick asset amouont: ", await product.convertToAssets(quickAddress, await product.balanceOf(nonDac.address)));

    // quick으로 전부 withdraw
    await product.connect(nonDac).withdraw(quickAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
    console.log("nonDac withdraw value: ", await usdPriceModule.getAssetUsdValue(quickAddress, await quickContract.balanceOf(nonDac.address)));
    console.log("유저의 share token 개수: ", await product.balanceOf(nonDac.address));
    console.log("product의 total supply: ", await product.totalSupply());
    console.log("product의 wmatic balance: ", await wMaticContract.balanceOf(product.address));
    console.log("유저의 quick 개수: ", await quickContract.balanceOf(nonDac.address));
    
    await product.deactivateProduct();
    await product.withdraw(wmaticAddress, ethers.constants.MaxUint256, dac.address, dac.address);
    console.log("product의 total supply: ", await product.totalSupply());
    console.log("product의 wmatic balance: ", await wMaticContract.balanceOf(product.address));
    console.log("dac의 wmatic 개수: ", await wMaticContract.balanceOf(dac.address));
  })
})

// test fail
describe('wmatic in - usdc out',async () => {
  it('wmatic in - usdc out',async () => {
    const {
      dac, nonDac,
      product, wmaticStrategy, 
      wethStrategy, ghstStrategy, 
      quickStrategy, usdcStrategy, 
      usdPriceModule
    } = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
    const {wMaticContract, usdcContract} =await getTokens(dac, nonDac);
    await activateProduct(dac, product, wMaticContract);

    // wmatic으로 30 token deposit
    await wMaticContract.connect(nonDac).approve(product.address, ethers.utils.parseEther("100"));
    await product.connect(nonDac).deposit(wmaticAddress, ethers.utils.parseEther("30"), nonDac.address)
    let beforePortfolio = await product.portfolioValue();
    let beforeProductWmatic = await product.assetBalance(wmaticAddress);
    console.log("user's deposit value: ", await usdPriceModule.getAssetUsdValue(wmaticAddress, parseEther("30")));
    console.log("product's total portfolio value: ", beforePortfolio);
    console.log("product's wmatic balance: ", beforeProductWmatic);

    // usdc로 전부 withdraw
    await product.connect(nonDac).withdraw(usdcAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
    let afterPortfolio =  await product.portfolioValue();
    let afterProductWmatic = await product.assetBalance(wmaticAddress);
    let userWithdrawalValue = await usdPriceModule.getAssetUsdValue(usdcAddress, await usdcContract.balanceOf(nonDac.address));
    console.log("user's withdraw value: ", userWithdrawalValue);
    console.log("product's total portfolio value: ",afterPortfolio);
    console.log("product's wmatic balance: ",afterProductWmatic);

    console.log("------------------------------------------------------------------")
   
    console.log("product portfolio before - after: ", beforePortfolio.sub(afterPortfolio));
    console.log("wmatic balance before - after: ", beforeProductWmatic.sub(afterProductWmatic));
    console.log("before portfolio - after portfolio vs withdraw value: ", beforePortfolio.sub(afterPortfolio).add(userWithdrawalValue));
    
    // 이후 product 상황 살펴가면서 fee가 어느정도 소비된것인지 확인하기
  })
})
