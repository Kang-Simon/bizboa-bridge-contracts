import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { PointToken } from "../../typechain";

describe("Test of PointToken", () => {
    let pointToken: PointToken;

    const provider = waffle.provider;
    const [owner, manager, providerManager, user01, user02, newProviderManager] = provider.getWallets();
    const ownerSigner = provider.getSigner(owner.address);
    const managerSigner = provider.getSigner(manager.address);
    const providerSigner = provider.getSigner(providerManager.address);
    const newProviderSigner = provider.getSigner(newProviderManager.address);
    const user01Signer = provider.getSigner(user01.address);
    const user02Signer = provider.getSigner(user02.address);
    const mintableAmount = 100000;

    before(async () => {
        const point = await ethers.getContractFactory("PointToken");
        pointToken = await point.deploy("TETRIS", "GBOA", providerManager.address, manager.address);
        await pointToken.deployed();
    });

    it("Check the token status", async () => {
        expect(await pointToken.name()).to.equal("TETRIS");
        expect(await pointToken.symbol()).to.equal("GBOA");
        expect(await pointToken.decimals()).to.equal(0);
        expect(await pointToken.totalSupply()).to.equal(0);
    });

    it("Test of Provider Manager", async () => {
        const token = await pointToken.connect(ownerSigner);
        expect(await token.getProvider()).to.eq(providerManager.address);
        expect(await token.getProvider()).to.not.eq(manager.address);
    });

    it("Test of Mintable by manager", async () => {
        await expect(pointToken.connect(ownerSigner).mint(user01.address, 100)).to.be.reverted;
        await expect(pointToken.connect(user01Signer).mint(user01.address, 100)).to.be.reverted;
        await expect(pointToken.connect(managerSigner).mint(user01.address, 100)).to.be.reverted;
        await expect(pointToken.connect(providerSigner).mint(user01.address, 100)).to.be.reverted;
        await expect(pointToken.connect(user01Signer).addMintableAmount(100)).to.be.reverted;
        await expect(pointToken.connect(providerSigner).addMintableAmount(100)).to.be.reverted;

        const token = await pointToken.connect(managerSigner);
        expect(await token.getMintableAmount()).to.eq(0);

        await expect(token.addMintableAmount(mintableAmount))
            .to.emit(token, "AddedMintableAmount")
            .withArgs(providerManager.address, mintableAmount, mintableAmount);

        expect(await token.getMintableAmount()).to.eq(mintableAmount);

        await expect(pointToken.connect(providerSigner).mint(user01.address, 100)).to.be.reverted;
        await expect(() => token.mint(user01.address, 100)).to.changeTokenBalance(token, user01, 100);

        expect(await token.getMintableAmount()).to.eq(mintableAmount - 100);
        expect(await token.balanceOf(user01.address)).to.eq(100);
    });

    it("Test transfer between user and user by disabling Allow transfer", async () => {
        expect(await pointToken.isAllowManagerIncludedTransfer()).to.eq(true);
        const token = await pointToken.connect(user01Signer);
        await expect(token.transfer(user02.address, 100)).to.be.reverted;
        expect(await token.balanceOf(user02.address)).to.equal(0);
    });

    it("Test transfer between user and user by enable Allow transfer", async () => {
        await expect(pointToken.connect(providerSigner).disableAllowManagerIncludedTransfer()).to.be.reverted;
        await expect(pointToken.connect(user01Signer).disableAllowManagerIncludedTransfer()).to.be.reverted;
        await pointToken.connect(managerSigner).disableAllowManagerIncludedTransfer();
        expect(await pointToken.isAllowManagerIncludedTransfer()).to.eq(false);

        const token = await pointToken.connect(user01Signer);
        await expect(() => token.transfer(user02.address, 100)).to.changeTokenBalance(token, user02, 100);
    });

    it("Test of mintable limit exceeded ", async () => {
        const ableAmount = await pointToken.getMintableAmount();
        const token = await pointToken.connect(managerSigner);
        await expect(() => token.mint(user01.address, ableAmount)).to.changeTokenBalance(token, user01, ableAmount);
        expect(await token.getMintableAmount()).to.eq(0);
        await expect(token.mint(user01.address, ableAmount)).to.reverted;
    });
});
