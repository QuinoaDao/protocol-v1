import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("whitelistRegistry contract test", async () => {
    it ("ownership test",async () => {
        const signers = await ethers.getSigners();
        const { product, whitelistRegistry } = await utils.deployContracts(signers[0]);

        expect(whitelistRegistry.connect(signers[32]).addProduct(product.address)).revertedWith("Ownable: caller is not the owner");
        expect(whitelistRegistry.connect(signers[32]).deleteProduct(product.address)).revertedWith("Ownable: caller is not the owner");
        expect(await whitelistRegistry.connect(signers[32]).checkProduct(product.address)).equal(false);
        expect(whitelistRegistry.connect(signers[32]).addWhitelist(product.address, signers[1].address)).revertedWith("Ownable: caller is not the owner");
        expect(whitelistRegistry.connect(signers[32]).deleteWhitelist(product.address, signers[1].address)).revertedWith("Ownable: caller is not the owner");
        expect(whitelistRegistry.connect(signers[32]).addMultipleWhitelists(product.address, [signers[1].address])).revertedWith("Ownable: caller is not the owner");
        expect(whitelistRegistry.connect(signers[32]).deleteMultipleWhitelists(product.address, [signers[1].address])).revertedWith("Ownable: caller is not the owner");

        await whitelistRegistry.addProduct(product.address);
        expect(await whitelistRegistry.connect(signers[32]).checkWhitelist(product.address, signers[1].address)).equal(false);

    })

    it("add product in whitelist registry", async () => {
        const signers = await ethers.getSigners();
        const { product, whitelistRegistry } = await utils.deployContracts(signers[0]);

        await whitelistRegistry.addProduct(product.address);
        expect(whitelistRegistry.addProduct(product.address)).revertedWith("The product already has whitelist");
        expect(await whitelistRegistry.checkProduct(product.address)).equal(true);
    })

    it("delete product in whitelist registry",async () => {
        const signers = await ethers.getSigners();
        const { product, whitelistRegistry } = await utils.deployContracts(signers[0]);

        expect(await whitelistRegistry.checkProduct(product.address)).equal(false);
        expect(whitelistRegistry.deleteProduct(product.address)).revertedWith("The product has no whitelist");

        await whitelistRegistry.addProduct(product.address);
        expect(await whitelistRegistry.checkProduct(product.address)).equal(true);

        await whitelistRegistry.deleteProduct(product.address);
        expect(await whitelistRegistry.checkProduct(product.address)).equal(false);

    })

    it("add user in whitelist",async () => {
        const signers = await ethers.getSigners();
        const { product, whitelistRegistry } = await utils.deployContracts(signers[0]);

        expect(whitelistRegistry.addWhitelist(product.address, signers[0].address)).revertedWith("The product has no whitelist");
        await whitelistRegistry.addProduct(product.address);
        expect(await whitelistRegistry.checkProduct(product.address)).equal(true);

        for (let i=0; i<151; i++){
            expect(await whitelistRegistry.checkWhitelist(product.address, signers[i].address)).equal(false);
            await whitelistRegistry.addWhitelist(product.address, signers[i].address);
            expect(await whitelistRegistry.checkWhitelist(product.address, signers[i].address)).equal(true);
        }

        let multipleUsers = [];

        for(let i=151; i<=300; i++){
            expect(await whitelistRegistry.checkWhitelist(product.address, signers[i].address)).equal(false);
            multipleUsers.push(signers[i].address);
        }

        expect(multipleUsers.length).equal(150);
        await whitelistRegistry.addMultipleWhitelists(product.address, multipleUsers);

        for(let i=151; i<300; i++){
            expect(await whitelistRegistry.checkWhitelist(product.address, signers[i].address)).equal(true);
        }

    })

    it("delete user in whitelist",async () => {
        const signers = await ethers.getSigners();
        const { product, whitelistRegistry } = await utils.deployContracts(signers[0]);
        
        await whitelistRegistry.addProduct(product.address);

        for (let i=0; i<151; i++){
            expect(await whitelistRegistry.checkWhitelist(product.address, signers[i].address)).equal(false);
            await whitelistRegistry.addWhitelist(product.address, signers[i].address);
            expect(await whitelistRegistry.checkWhitelist(product.address, signers[i].address)).equal(true);
            await whitelistRegistry.deleteWhitelist(product.address, signers[i].address);
            expect(await whitelistRegistry.checkWhitelist(product.address, signers[i].address)).equal(false);
        }

        let multipleUsers = [];

        for(let i=151; i<=300; i++){
            multipleUsers.push(signers[i].address);
        }

        expect(multipleUsers.length).equal(150);
        await whitelistRegistry.addMultipleWhitelists(product.address, multipleUsers);
        await whitelistRegistry.deleteMultipleWhitelists(product.address, multipleUsers);

        for(let i=151; i<300; i++){
            expect(await whitelistRegistry.checkWhitelist(product.address, signers[i].address)).equal(false);
        }
    })

})