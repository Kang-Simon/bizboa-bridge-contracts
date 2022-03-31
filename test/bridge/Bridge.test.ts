import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, waffle } from "hardhat";
import { BOABridge, TestERC20 } from "../../typechain";
import { ContractUtils } from "../ContractUtils";

import * as assert from "assert";

chai.use(solidity);

describe("Cross Chain HTLC Atomic Swap with ERC20", () => {
    let bridge_ethnet: BOABridge;
    let token_ethnet: TestERC20;
    let bridge_biznet: BOABridge;
    let token_biznet: TestERC20;

    const provider = waffle.provider;
    const [admin, user, manager, fee_manager] = provider.getWallets();
    const admin_signer = provider.getSigner(admin.address);
    const user_signer = provider.getSigner(user.address);
    const manager_signer = provider.getSigner(manager.address);

    let lock: string;
    let key: string;

    let lock_box_id: string;

    const liquidity_amount = 1000000;
    const swap_amount = 10000;
    const time_lock = 60 * 60 * 24;

    const swap_fee = 100;
    const tx_fee = 200;
    const total_fee = swap_fee + tx_fee;

    before(async () => {
        const BOABridgeFactory = await ethers.getContractFactory("BOABridge");
        const TestERC20Factory = await ethers.getContractFactory("TestERC20");

        token_ethnet = await TestERC20Factory.deploy("BOSAGORA Token", "BOA1");
        await token_ethnet.deployed();
        bridge_ethnet = (await BOABridgeFactory.deploy(
            token_ethnet.address,
            time_lock,
            fee_manager.address
        )) as BOABridge;
        await bridge_ethnet.deployed();

        token_biznet = await TestERC20Factory.deploy("BOSAGORA Token", "BOA2");
        await token_biznet.deployed();
        bridge_biznet = await BOABridgeFactory.deploy(token_biznet.address, time_lock, fee_manager.address);
        await bridge_biznet.deployed();
    });

    context("EthNet: User -> Contract, BizNet : Contract -> User", async () => {
        before("Distribute the fund", async () => {
            await token_ethnet.connect(admin_signer).transfer(user.address, swap_amount);
        });

        before("Send liquidity", async () => {
            await token_ethnet.connect(admin_signer).approve(bridge_ethnet.address, liquidity_amount);
            await bridge_ethnet.connect(admin_signer).increaseLiquidity(admin.address, liquidity_amount);
            await token_biznet.connect(admin_signer).approve(bridge_biznet.address, liquidity_amount);
            await bridge_biznet.connect(admin_signer).increaseLiquidity(admin.address, liquidity_amount);
        });

        it("Add a manager", async () => {
            await bridge_ethnet.connect(admin_signer).addManager(manager.address);
            await bridge_biznet.connect(admin_signer).addManager(manager.address);
        });

        it("Check the balance", async () => {
            const user_balance = await token_biznet.balanceOf(user.address);
            assert.strictEqual(user_balance.toNumber(), 0);
        });

        it("Create key by User", () => {
            const key_buffer = ContractUtils.createKey();
            const lock_buffer = ContractUtils.sha256(key_buffer);
            key = ContractUtils.BufferToString(key_buffer);
            lock = ContractUtils.BufferToString(lock_buffer);
            lock_box_id = ContractUtils.BufferToString(ContractUtils.createLockBoxID());
        });

        it("Open the lock box in EthNet by User", async () => {
            await token_ethnet.connect(user_signer).approve(bridge_ethnet.address, swap_amount);
            expect(
                await bridge_ethnet
                    .connect(user_signer)
                    .openDeposit(lock_box_id, swap_amount, swap_fee, tx_fee, user.address, lock)
            ).to.emit(bridge_ethnet, "OpenDeposit");
        });

        it("Check the lock box in EthNet by Manager", async () => {
            const result = await bridge_ethnet.checkDeposit(lock_box_id);
            assert.strictEqual(result[0].toString(), "1");
            assert.strictEqual(result[2].toNumber(), swap_amount);
            assert.strictEqual(result[3].toNumber(), swap_fee);
            assert.strictEqual(result[4].toNumber(), tx_fee);
            assert.strictEqual(result[5].toString(), user.address);
            assert.strictEqual(result[6].toString(), user.address);
            assert.strictEqual(result[7].toString(), lock);
        });

        it("Open the lock box in BizNet by Manager", async () => {
            expect(
                await bridge_biznet
                    .connect(manager_signer)
                    .openWithdraw(lock_box_id, swap_amount, swap_fee, tx_fee, user.address, user.address, lock)
            ).to.emit(bridge_biznet, "OpenWithdraw");
        });

        it("Check the lock box in BizNet by User", async () => {
            const result = await bridge_biznet.connect(user_signer).checkWithdraw(lock_box_id);
            assert.strictEqual(result[0].toString(), "1");
            assert.strictEqual(result[2].toNumber(), swap_amount);
            assert.strictEqual(result[3].toNumber(), swap_fee);
            assert.strictEqual(result[4].toNumber(), tx_fee);
            assert.strictEqual(result[5].toString(), user.address);
            assert.strictEqual(result[6].toString(), user.address);
            assert.strictEqual(result[7].toString(), lock);
        });

        it("Close the lock box in BizNet by Manager", async () => {
            expect(await bridge_biznet.connect(manager_signer).closeWithdraw(lock_box_id, key)).to.emit(
                bridge_biznet,
                "CloseWithdraw"
            );
            const user_balance = await token_biznet.balanceOf(user.address);
            assert.strictEqual(user_balance.toNumber(), swap_amount - total_fee);
            const bridge_biznet_balance = await token_biznet.balanceOf(bridge_biznet.address);
            assert.strictEqual(bridge_biznet_balance.toNumber(), liquidity_amount - swap_amount + total_fee);
        });

        it("Close the lock box in EthNet by Manager", async () => {
            const secretKey = await bridge_biznet.checkSecretKeyWithdraw(lock_box_id);
            expect(await bridge_ethnet.connect(manager_signer).closeDeposit(lock_box_id, secretKey)).to.emit(
                bridge_ethnet,
                "CloseDeposit"
            );
            const bridge_ethnet_balance = await token_ethnet.balanceOf(bridge_ethnet.address);
            assert.strictEqual(bridge_ethnet_balance.toNumber(), liquidity_amount + swap_amount);
        });

        it("Only the manager can open the withdraw lock box", async () => {
            const box_id = ContractUtils.BufferToString(ContractUtils.createLockBoxID());
            await assert.rejects(
                bridge_biznet
                    .connect(user_signer)
                    .openWithdraw(box_id, swap_amount, 0, 0, user.address, user.address, lock)
            );
        });

        it("Transaction is rejected if the fee is insufficient", async () => {
            await token_ethnet.connect(user_signer).approve(bridge_ethnet.address, swap_amount);
            await expect(
                bridge_ethnet
                    .connect(user_signer)
                    .openDeposit(
                        ContractUtils.BufferToString(ContractUtils.createLockBoxID()),
                        swap_amount,
                        swap_amount,
                        tx_fee,
                        user.address,
                        lock
                    )
            ).to.be.reverted;
        });

        it("Check the liquidity balance of manager", async () => {
            const fee_balance_eth = await bridge_ethnet.balanceOfLiquidity(fee_manager.address);
            assert.strictEqual(fee_balance_eth.toNumber(), total_fee);
            const fee_balance_biz = await bridge_biznet.balanceOfLiquidity(fee_manager.address);
            assert.strictEqual(fee_balance_biz.toNumber(), 0);
        });
    });

    context("Expiry Deposit Lock Box", async () => {
        const lockBox_expiry = ContractUtils.BufferToString(ContractUtils.createLockBoxID());

        before("Distribute the fund", async () => {
            await token_ethnet.connect(admin_signer).transfer(user.address, swap_amount);
        });

        before("Set time lock", async () => {
            const timeout = 1;
            await bridge_ethnet.connect(manager_signer).changeTimeLock(timeout);
        });

        it("Open Deposit Lock Box", async () => {
            await token_ethnet.connect(user_signer).approve(bridge_ethnet.address, swap_amount);
            await bridge_ethnet.connect(user_signer).openDeposit(lockBox_expiry, swap_amount, 0, 0, user.address, lock);
        });

        it("No Expiry", async () => {
            await assert.rejects(bridge_ethnet.connect(user_signer).expireDeposit(lockBox_expiry));
        });

        it("Expiry", async () => {
            await new Promise<void>((resolve, reject) =>
                setTimeout(async () => {
                    try {
                        await bridge_ethnet.connect(user_signer).expireDeposit(lockBox_expiry);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                }, 2 * 1000)
            );
        });
    });

    context("Expiry Withdraw Lock Box", async () => {
        const lockBox_expiry = ContractUtils.BufferToString(ContractUtils.createLockBoxID());

        before("Distribute the fund", async () => {
            await token_ethnet.connect(admin_signer).transfer(user.address, swap_amount);
        });

        before("Set time lock", async () => {
            const timeout = 2;
            await bridge_ethnet.connect(manager_signer).changeTimeLock(timeout);
        });

        it("Open Withdraw Lock Box", async () => {
            await bridge_ethnet
                .connect(manager_signer)
                .openWithdraw(lockBox_expiry, swap_amount, 0, 0, user.address, user.address, lock);
        });

        it("No Expiry", async () => {
            await assert.rejects(bridge_ethnet.connect(manager_signer).expireWithdraw(lockBox_expiry));
        });

        it("Expiry", async () => {
            return new Promise<void>((resolve, reject) =>
                setTimeout(async () => {
                    try {
                        await bridge_ethnet.connect(manager_signer).expireWithdraw(lockBox_expiry);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                }, 2 * 1000)
            );
        });
    });
});
