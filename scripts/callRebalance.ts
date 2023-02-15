import { ethers } from "hardhat";
import { Product, UsdPriceModule, Strategy } from "../typechain-types";
import { abi as productAbi} from "../artifacts/contracts/Product.sol/Product.json";
import wMaticAbi from "../abis/wMaticABI.json";

import * as dotenv from "dotenv";
dotenv.config();


const productAddress = "0x2cc5cf8E315a3B8076321d640a17b29387496dB9";
const network = "mumbai";
const dacAddress = "0xc9DA5f7c5536FDBB013dC8A7186F36B85d4eaBE4"
const wmaticAddress = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"

async function getProduct() {
    // Deploy the contract to the test network
    // const Product = await ethers.getContractFactory("Product");
    const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_MUMBAI_URL);
    const signer = new ethers.Wallet(process.env.TEST_ACC1, provider);
    const product = await ethers.getContractAt(productAbi, productAddress, signer);

    // const depositAmount = ethers.utils.parseUnits("0.05")
    // const wmaticContract = new ethers.Contract(wmaticAddress, wMaticAbi, signer);
    // const approveTx = await wmaticContract.approve(product.address, depositAmount);
    // await approveTx.wait();
    // const mintTx = await product.deposit(wmaticAddress, depositAmount, await signer.address);
    // const mintReceipt = await mintTx.wait();
    // console.log(mintReceipt);

    console.log(await product.checkActivation());
    console.log(await product.name());
    console.log(await product.dacAddress());
    console.log(await signer.address);

    let tx = await product.estimateGas.rebalance({gasLimit: 500000000,});
    // const receipt = await tx.wait();
    // console.log(tx);
    // console.log(receipt);
    
    
}

async function main(){
    await getProduct();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
