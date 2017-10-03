let StentorToken = artifacts.require('./StentorToken.sol');
let StentorCrowdsale = artifacts.require('./test/StentorCrowdsaleMock.sol');
let RefundVault = artifacts.require('./zeppelin/contracts/crowdsale/RefundVault.sol');
let VestedWallet = artifacts.require('./test/VestedWalletMock.sol');
let MultiSigWallet = artifacts.require('./MultiSigWallet.sol');

let config = require('./../config');
const assertFail = require("./helpers/assertFail");
const hashMessage = require('./helpers/hashMessage.js');

// const waitForEvents = require("./helpers/waitForEvents");

contract('StentorCrowdsale', async function (accounts) {

    let token, crowdsale, vault, vestedWallet, startTime, endTime, foundationWallet;
    const signers = [accounts[2]];
    const signer = accounts[0]; //signature is required for each contribution

    beforeEach(async () => {
        startTime = Math.floor(+new Date() / 1000) + 10; //10 seconds into the future
        endTime = Math.floor(+new Date() / 1000) + 3600; //1 hour into the future

        foundationWallet = await MultiSigWallet.new(signers, signers.length);
        vault = await RefundVault.new(foundationWallet.address);
        token = await StentorToken.new(config.initialSupply);
        crowdsale = await StentorCrowdsale.new(startTime, endTime, config.rate, config.goal, config.cap, config.individualCap, vault.address, token.address, signer);
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
        //calculatedTokens = foundation initial amount + 100% of team's vested tokens
        const calculatedTokens = web3.fromWei(totalSupply.mul(teamOwned).add(config.foundation.amount)).toNumber();
        const realTokens = web3.fromWei(balance).toNumber();
        assert.equal(realTokens, calculatedTokens, "Tokens vested incorrectly");
    });

    it("Must provide valid signature for contribution to go through", async () => {
        const contributor = accounts[1];
        const signature = web3.eth.sign(signer, web3.sha3(contributor, {encoding: 'hex'}));
        const contributing = web3.toWei(1, 'wei');

        const beforeTokens = await token.balanceOf(contributor);
        await crowdsale.setMockedTime(startTime + 1);
        await crowdsale.buyTokens(hashMessage(contributor), signature, {value: contributing, from: contributor});
        const afterTokens = await token.balanceOf(contributor);

        assert.equal(beforeTokens, afterTokens.toNumber() - config.rate * contributing, "Contributor did not receive the correct amount of tokens");
    });

    it("Cannot contribute beyond specified individual cap", async () => {
        const contributor = accounts[1];
        const signature = web3.eth.sign(signer, web3.sha3(contributor, {encoding: 'hex'}));
        const contributing = config.individualCap;

        const beforeTokens = await token.balanceOf(contributor);
        await crowdsale.setMockedTime(startTime + 1);
        await crowdsale.buyTokens(hashMessage(contributor), signature, {value: contributing, from: contributor});
        const afterTokens = await token.balanceOf(contributor);

        assert.equal(beforeTokens, afterTokens.toNumber() - config.rate * contributing, "Contributor did not receive the correct amount of tokens");

        await crowdsale.setMockedTime(startTime + 1);
        await assertFail(async function () {
            await crowdsale.buyTokens(hashMessage(contributor), signature, {value: 1, from: contributor});
        });
        const sameAmountOfTokens = await token.balanceOf(contributor);

        assert.equal(afterTokens.toNumber(), sameAmountOfTokens.toNumber(), "Contributor was able to exceed individual cap");
    });

    it("Contributions can only be made during the crowdsale", async () => {
        const contributor = accounts[1];
        const signature = web3.eth.sign(signer, web3.sha3(contributor, {encoding: 'hex'}));

        const beforeTokens = await token.balanceOf(contributor);
        await crowdsale.setMockedTime(startTime - 1);
        await assertFail(async function () {
            await crowdsale.buyTokens(hashMessage(contributor), signature, {value: 1, from: contributor});
        });
        const afterTokens = await token.balanceOf(contributor);

        assert.equal(beforeTokens, afterTokens.toNumber(), "Contributor was able to purchase tokens before the start");

        await crowdsale.setMockedTime(endTime + 1);
        await assertFail(async function () {
            await crowdsale.buyTokens(hashMessage(contributor), signature, {value: 1, from: contributor});
        });
        const sameAmountOfTokens = await token.balanceOf(contributor);

        assert.equal(afterTokens.toNumber(), sameAmountOfTokens.toNumber(), "Contributor was able to purchase tokens after the end");
    });

    it("Contributions cannot be made once the hard cap has been hit", async () => {
        //deploy with hard cap == individual cap for easier testing
        startTime = Math.floor(+new Date() / 1000) + 10; //10 seconds into the future
        endTime = Math.floor(+new Date() / 1000) + 3600; //1 hour into the future

        foundationWallet = await MultiSigWallet.new(signers, signers.length);
        vault = await RefundVault.new(foundationWallet.address);
        token = await StentorToken.new(config.initialSupply);
        crowdsale = await StentorCrowdsale.new(startTime, endTime, config.rate, 1, config.individualCap, config.individualCap, vault.address, token.address, signer);
        vestedWallet = await VestedWallet.new(foundationWallet.address, crowdsale.address, token.address);

        await token.transfer(crowdsale.address, config.cap);
        await token.transfer(vestedWallet.address, config.team.amount);
        await token.transfer(foundationWallet.address, config.foundation.amount);

        //transfer control of the vault to the crowdsale
        await vault.transferOwnership(crowdsale.address);

        //transfer control of the crowdsale to the foundation's multisig
        await crowdsale.transferOwnership(foundationWallet.address);

        const contributor = accounts[1];
        const signature = web3.eth.sign(signer, web3.sha3(contributor, {encoding: 'hex'}));
        const contributing = config.individualCap - 1;

        const beforeTokens = await token.balanceOf(contributor);
        await crowdsale.setMockedTime(startTime + 1);
        await crowdsale.buyTokens(hashMessage(contributor), signature, {value: contributing, from: contributor});
        const afterTokens = await token.balanceOf(contributor);

        assert.equal(beforeTokens, afterTokens.toNumber() - config.rate * contributing, "Contributor did not receive the correct amount of tokens");

        await assertFail(async function () {
            await crowdsale.buyTokens(hashMessage(contributor), signature, {value: 1, from: contributor});
        });
        const sameAmountOfTokens = await token.balanceOf(contributor);

        assert.equal(afterTokens.toNumber(), sameAmountOfTokens.toNumber(), "Contributor was able to purchase tokens after the hard cap was hit");
    });

    it("Should not allow contributions to go through if the contract has been paused", async () => {
        const contributor = accounts[1];
        const signature = web3.eth.sign(signer, web3.sha3(contributor, {encoding: 'hex'}));
        const contributing = web3.toWei(1, 'wei');

        const beforeTokens = await token.balanceOf(contributor);
        await crowdsale.setMockedTime(startTime + 1);

        //pause crowdsale
        await foundationWallet.submitTransaction(crowdsale.address, 0, crowdsale.contract.pause.getData(), {
            from: signers[0],
            gas: 1000000
        });

        await assertFail(async function () {
            await crowdsale.buyTokens(hashMessage(contributor), signature, {value: contributing, from: contributor});
        });
        const afterTokens = await token.balanceOf(contributor);

        assert.equal(beforeTokens, afterTokens.toNumber(), "Contributor was able to buy tokens while the campaign was paused");
    });

});