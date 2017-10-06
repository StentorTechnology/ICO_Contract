let StentorToken = artifacts.require('./StentorToken.sol');
let StentorCrowdsale = artifacts.require('./test/StentorCrowdsaleMock.sol');
let RefundVault = artifacts.require('./zeppelin/contracts/crowdsale/RefundVault.sol');
let VestedWallet = artifacts.require('./test/VestedWalletMock.sol');
let MultiSigWallet = artifacts.require('./MultiSigWallet.sol');

let config = require('./../config');
const assertFail = require("./helpers/assertFail");
const waitForEvents = require("./helpers/waitForEvents");

contract('StentorCrowdsale', async function (accounts) {

    let token, crowdsale, vault, vestedWallet, startTime, endTime, foundationWallet;
    const signers = [accounts[1]];
    const controller = accounts[2];
    const contributor = accounts[3];

    beforeEach(async () => {
        startTime = Math.floor(+new Date() / 1000) + 10; //10 seconds into the future
        endTime = Math.floor(+new Date() / 1000) + 3600; //1 hour into the future

        foundationWallet = await MultiSigWallet.new(signers, signers.length);
        vault = await RefundVault.new(foundationWallet.address);
        token = await StentorToken.new(config.initialSupply);
        crowdsale = await StentorCrowdsale.new(startTime, endTime, config.rate, config.goal, config.cap, config.individualCap, vault.address, token.address, controller);
        vestedWallet = await VestedWallet.new(foundationWallet.address, crowdsale.address, token.address);

        await token.transfer(crowdsale.address, config.cap);
        await token.transfer(vestedWallet.address, config.team.amount);
        await token.transfer(foundationWallet.address, config.foundation.amount);

        //transfer control of the vault to the crowdsale
        await vault.transferOwnership(crowdsale.address);

        //transfer control of the crowdsale to the foundation's multisig
        await crowdsale.transferOwnership(foundationWallet.address);
    });

    it("Token deployed correctly with the right symbol", async () => {
        assert.equal(await token.symbol.call(), "SGT", "Token symbol not equal to SGT");
    });

    it("Token correctly transferred initialSupply", async () => {
        assert.equal(await token.balanceOf(crowdsale.address), config.cap);
        assert.equal(await token.balanceOf(vestedWallet.address), config.team.amount);
        assert.equal(await token.balanceOf(foundationWallet.address), config.foundation.amount);
    });

    it("Should not allow any tokens to be transferred before the crowdsale ends", async () => {
        await assertFail(async function () {
            await vestedWallet.collectTokens({from: foundationWallet.address});
        });
    });

    it("Should not allow any tokens after the crowdsale is finalized, but before 6 months", async () => {
        //set mock time so that the crowdsale has ended
        await crowdsale.setMockedTime(endTime + 1);

        await foundationWallet.submitTransaction(crowdsale.address, 0, crowdsale.contract.finalize.getData(), {
            from: signers[0],
            gas: 1000000
        });

        await foundationWallet.submitTransaction(vestedWallet.address, 0, vestedWallet.contract.collectTokens.getData(), {
            from: signers[0],
            gas: 1000000
        });

        //the foundation starts off with config.foundation.amount, but shouldn't receive any more tokens until after the tokens vest
        assert.equal(await token.balanceOf(foundationWallet.address), config.foundation.amount, "Vested tokens transferred before vested period began");
    });

    it("Should not allow transfer to occur even after 6 months unless the crowdsale was finalized", async () => {
        const sixMonths = Math.floor(+new Date() / 1000) + (86400 * 180) + 1; //6 months
        await vestedWallet.setMockedTime(sixMonths);

        await foundationWallet.submitTransaction(vestedWallet.address, 0, vestedWallet.contract.collectTokens.getData(), {
            from: signers[0],
            gas: 1000000
        });

        //the foundation starts off with config.foundation.amount, but shouldn't receive any more tokens until after the tokens vest
        assert.equal(await token.balanceOf(foundationWallet.address), config.foundation.amount, "Vested tokens transferred before vested period began");
    });

    it("Should allow the transfer of some vested tokens six months after the crowdsale was finalized", async () => {
        await crowdsale.setMockedTime(endTime + 1);
        await foundationWallet.submitTransaction(crowdsale.address, 0, crowdsale.contract.finalize.getData(), {
            from: signers[0],
            gas: 1000000
        });
        const oneYear = (await crowdsale.finalizedTime()).toNumber() + (86400 * 360);

        await vestedWallet.setMockedTime(oneYear);
        await foundationWallet.submitTransaction(vestedWallet.address, 0, vestedWallet.contract.collectTokens.getData(), {
            from: signers[0],
            gas: 1000000
        });

        const totalSupply = await token.totalSupply.call();
        const balance = await token.balanceOf(foundationWallet.address);
        const teamOwned = config.team.amount / config.initialSupply; //percentage of totalSupply that the team (not foundation) owns

        //calculate how many tokens the foundation should have after one year
        //calculatedTokens = foundation initial amount + 50% of team's vested tokens
        const calculatedTokens = web3.fromWei(totalSupply.mul(teamOwned).mul(.50).add(config.foundation.amount)).toNumber();
        const realTokens = web3.fromWei(balance).toNumber();
        assert.equal(realTokens, calculatedTokens, "Tokens vested incorrectly");
    });

    it("Tokens should fully vest two years after the crowdsale has ended", async () => {
        await crowdsale.setMockedTime(endTime + 1);
        await foundationWallet.submitTransaction(crowdsale.address, 0, crowdsale.contract.finalize.getData(), {
            from: signers[0],
            gas: 1000000
        });
        const twoYears = (await crowdsale.finalizedTime()).toNumber() + (86400 * 360 * 2);

        await vestedWallet.setMockedTime(twoYears);
        await foundationWallet.submitTransaction(vestedWallet.address, 0, vestedWallet.contract.collectTokens.getData(), {
            from: signers[0],
            gas: 1000000
        });

        const totalSupply = await token.totalSupply.call();
        const balance = await token.balanceOf(foundationWallet.address);
        const teamOwned = config.team.amount / config.initialSupply; //percentage of totalSupply that the team (not foundation) owns

        //calculate how many tokens the foundation should have after one year
        //calculatedTokens = foundation initial amount + 50% of team's vested tokens
        const calculatedTokens = web3.fromWei(totalSupply.mul(teamOwned).add(config.foundation.amount)).toNumber();
        const realTokens = web3.fromWei(balance).toNumber();
        assert.equal(realTokens, calculatedTokens, "Tokens vested incorrectly");
    });

    it("Controlled can only be changed by the owner", async () => {
        const newController = accounts[0];
        await foundationWallet.submitTransaction(crowdsale.address, 0, crowdsale.contract.changeController.getData(newController), {
            from: signers[0],
            gas: 1000000
        });

        assert.equal(await crowdsale.controller(), newController, "Controller was not changed succesfully");

        //ensure no one else can change the controller but the owner
        await assertFail(async function() {
           await crowdsale.changeController(accounts[2], {from: accounts[2]});
        });

        assert.equal(await crowdsale.controller(), newController, "Controller was changed by non-owner");
    });

    it("Only an approved contributor can make a contribution", async () => {
        const contribution = 1;

        await crowdsale.setMockedTime(startTime + 1);
        await assertFail(async function () {
            await crowdsale.buyTokens({from: contributor, value: contribution});
        });

        //approve the contributor
        await crowdsale.approveContributor(contributor, {from: controller});

        //remove the contributor to see if they can buy tokens
        await crowdsale.removeContributor(contributor, {from: controller});
        await assertFail(async function () {
            await crowdsale.buyTokens({from: contributor, value: contribution});
        });

        //approve the contributor and see if they can buy now
        await crowdsale.approveContributor(contributor, {from: controller});
        await crowdsale.buyTokens({from: contributor, value: contribution});
        assert.equal(await token.balanceOf(contributor), config.rate * contribution, "Contributor did not receive the correct amount of tokens");
    });

    it("Bulk approval and removal of contributors", async () => {
        const contributors = [accounts[4], accounts[5], accounts[6]];
        await crowdsale.approveContributors(contributors, {from: controller});
        await crowdsale.removeContributors(contributors, {from: controller});

        await assertFail(async function () {
            await crowdsale.buyTokens({from: contributors[2], value: contribution});
        });

        await crowdsale.approveContributors(contributors, {from: controller});
        await crowdsale.setMockedTime(startTime + 1);

        const contribution = 1;
        await crowdsale.buyTokens({from: contributors[2], value: contribution});
        assert.equal(await token.balanceOf(contributors[2]), config.rate * contribution, "Contributor did not receive the correct amount of tokens");
    });

    it("A contributor cannot contribute more than the individual cap, excess is refunded", async () => {
        const contribution = web3.toBigNumber(config.individualCap).plus(1);

        await crowdsale.setMockedTime(startTime + 1);
        await crowdsale.approveContributor(contributor, {from: controller});
        await crowdsale.buyTokens({from: contributor, value: contribution});

        assert.equal(await token.balanceOf(contributor), config.rate * config.individualCap, "Contributor exceeded the indvidual cap");
        assert.equal(await web3.eth.getBalance(crowdsale.address), 0, "Crowdsale did not refund correctly");
        assert.equal(await web3.eth.getBalance(vault.address), config.individualCap, "Vault did not receive the correct amount of ETH");
    });

    it("Contributions can only be made during the crowdsale", async() => {
        await crowdsale.approveContributor(contributor, {from: controller});

        const beforeTokens = await token.balanceOf(contributor);
        await crowdsale.setMockedTime(startTime - 1);
        await assertFail(async function () {
            await crowdsale.buyTokens({value: 1, from: contributor});
        });
        const afterTokens = await token.balanceOf(contributor);

        assert.equal(beforeTokens.toNumber(), afterTokens.toNumber(), "Contributor was able to purchase tokens before the start");

        await crowdsale.setMockedTime(endTime + 1);
        await assertFail(async function () {
            await crowdsale.buyTokens({value: 1, from: contributor});
        });
        const sameAmountOfTokens = await token.balanceOf(contributor);

        assert.equal(afterTokens.toNumber(), sameAmountOfTokens.toNumber(), "Contributor was able to purchase tokens after the end");
    });

    it("Should not allow contributions if the hard cap has been hit", async () => {
        //set mock hardcap == individual cap for easier testing
        await crowdsale.setMockedCap(config.individualCap);
        await crowdsale.setMockedTime(startTime + 1);
        await crowdsale.approveContributor(contributor, {from: controller});

        const beforeTokens = await token.balanceOf(contributor);
        const contribution = config.individualCap;
        await crowdsale.buyTokens({value: contribution, from: contributor});
        const afterTokens = await token.balanceOf(contributor);

        assert.equal(beforeTokens, afterTokens.toNumber() - config.rate * contribution, "Contributor did not receive the correct amount of tokens");

        await assertFail(async function () {
            await crowdsale.buyTokens({value: 1, from: contributor});
        });
        const sameAmountOfTokens = await token.balanceOf(contributor);

        assert.equal(afterTokens.toNumber(), sameAmountOfTokens.toNumber(), "Contributor was able to purchase tokens after the hard cap was hit");
        assert.equal(await crowdsale.hasEnded(), true, "Crowdsale hasEnded function did not return true");
    });

    it("Should not allow contributions to go through if the contract has been paused", async () => {
        await crowdsale.setMockedTime(startTime + 1);
        await crowdsale.approveContributor(contributor, {from: controller});
        await foundationWallet.submitTransaction(crowdsale.address, 0, crowdsale.contract.pause.getData(), {
            from: signers[0],
            gas: 1000000
        });
        await assertFail(async function () {
            await crowdsale.buyTokens({value: 1, from: contributor});
        });
        await foundationWallet.submitTransaction(crowdsale.address, 0, crowdsale.contract.unpause.getData(), {
            from: signers[0],
            gas: 1000000
        });
        await crowdsale.buyTokens({value: 1, from: contributor});
        assert.equal(await token.balanceOf(contributor), config.rate, "Contributor should receive 1 wei of tokens");
    });

    it("Contributors should be able to withdraw if the goal has not been met and the crowdsale has ended", async () => {
        await crowdsale.setMockedTime(startTime + 1);
        await crowdsale.approveContributor(contributor, {from: controller});

        const beforeTokens = await token.balanceOf(contributor);
        const contribution = web3.toBigNumber(config.individualCap);
        const balanceBefore = await web3.eth.getBalance(contributor);
        await crowdsale.buyTokens({value: contribution, from: contributor});
        const afterTokens = await token.balanceOf(contributor);

        assert.equal(beforeTokens, afterTokens.toNumber() - config.rate * contribution, "Contributor did not receive the correct amount of tokens");
        assert.equal(await crowdsale.goalReached(), false, "Goal should have been reached");

        //force crowdsale to end
        await crowdsale.setMockedTime(endTime + 1);
        assert.equal(await crowdsale.hasEnded(), true, "Crowdsale should have ended");
        await foundationWallet.submitTransaction(crowdsale.address, 0, crowdsale.contract.finalize.getData(), {
            from: signers[0],
            gas: 1000000
        });
        assert.equal(await crowdsale.isFinalized(), true, "Crowdsale should have been finalized");
        assert.equal((await web3.eth.getBalance(foundationWallet.address)).toNumber(), 0, "Funds contributed to the campaign were forwarded to the foundation erroneously");

        await crowdsale.claimRefund({from: contributor});
        assert.equal((await web3.eth.getBalance(vault.address)).toNumber(), 0, "Contributor was not refunded correctly");
    });

    it("Funds should be forwarded if the goal is met and the crowdsale has ended", async () => {
        //set mock hardcap == individual cap for easier testing
        await crowdsale.setMockedCap(config.individualCap);
        //set mock goal == hardcap - 1 for easier testing
        await crowdsale.setMockedGoal(web3.toBigNumber(config.individualCap).minus(1));
        await crowdsale.setMockedTime(startTime + 1);
        await crowdsale.approveContributor(contributor, {from: controller});

        const beforeTokens = await token.balanceOf(contributor);
        const contribution = web3.toBigNumber(config.individualCap).minus(1);
        await crowdsale.buyTokens({value: contribution, from: contributor});
        const afterTokens = await token.balanceOf(contributor);

        assert.equal(beforeTokens, afterTokens.toNumber() - config.rate * contribution, "Contributor did not receive the correct amount of tokens");
        assert.equal(await crowdsale.hasEnded(), false, "Crowdsale hasEnded function did not return false");
        assert.equal(await crowdsale.goalReached(), true, "Goal should have been reached");

        //force crowdsale to end
        await crowdsale.setMockedTime(endTime + 1);
        assert.equal(await crowdsale.hasEnded(), true, "Crowdsale should have ended");
        await foundationWallet.submitTransaction(crowdsale.address, 0, crowdsale.contract.finalize.getData(), {
            from: signers[0],
            gas: 1000000
        });
        assert.equal(await crowdsale.isFinalized(), true, "Crowdsale should have been finalized");
        assert.equal((await web3.eth.getBalance(foundationWallet.address)).toNumber(), contribution.toNumber(), "Funds contributed to the campaign did not forward correctly to the foundation");
    });

});