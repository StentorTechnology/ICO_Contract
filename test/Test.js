let StentorToken = artifacts.require('./StentorToken.sol');
let StentorCrowdsale = artifacts.require('./test/StentorCrowdsaleMock.sol');
let RefundVault = artifacts.require('./zeppelin/contracts/crowdsale/RefundVault.sol');
let VestedWallet = artifacts.require('./test/VestedWalletMock.sol');

let config = require('./../config');
const assertFail = require("./helpers/assertFail");
const waitForEvents = require("./helpers/waitForEvents");

contract('StentorCrowdsale', async function (accounts) {

    let token, crowdsale, vault, vestedWallet, startTime, endTime;
    const crowdsaleWallet = accounts[0];
    const foundationWallet = accounts[2];

    beforeEach(async () => {
        startTime = Math.floor(+new Date() / 1000) + 10; //10 seconds into the future
        endTime = Math.floor(+new Date() / 1000) + 3600; //1 hour into the future

        vault = await RefundVault.new(crowdsaleWallet);
        token = await StentorToken.new(config.initialSupply);
        crowdsale = await StentorCrowdsale.new(startTime, endTime, config.rate, config.goal, config.cap, vault.address, token.address);
        vestedWallet = await VestedWallet.new(foundationWallet, crowdsale.address, token.address, {from: foundationWallet});

        await token.transfer(crowdsale.address, config.cap);
        await token.transfer(vestedWallet.address, config.team.amount);
        await token.transfer(foundationWallet, config.foundation.amount);

        //transfer control of the vault to the crowdsale
        await vault.transferOwnership(crowdsale.address);
    });

    it("Token deployed correctly with the right symbol", async () => {
        assert.equal(await token.symbol.call(), "SGT", "Token symbol not equal to SGT");
    });

    it("Token correctly transferred initialSupply", async () => {
        assert.equal(await token.balanceOf(crowdsale.address), config.cap);
        assert.equal(await token.balanceOf(vestedWallet.address), config.team.amount);
        assert.equal(await token.balanceOf(foundationWallet), config.foundation.amount);
    });

    it("Should not allow any tokens to be transferred before the crowdsale ends", async () => {
        await assertFail(async function () {
            await vestedWallet.collectTokens({from: foundationWallet});
        });
    });

    it("Should not allow any tokens after the crowdsale is finalized, but before 6 months", async () => {
        //set mock time so that the crowdsale has ended
        await crowdsale.setMockedTime(endTime + 1);
        await crowdsale.finalize();

        await assertFail(async function() {
            await vestedWallet.collectTokens({from: foundationWallet});
        });

        //the foundation starts off with config.foundation.amount, but shouldn't receive any more tokens until after the tokens vest
        assert.equal(await token.balanceOf(foundationWallet), config.foundation.amount, "Vested tokens transferred before vested period began");
    });

    it("Should not allow transfer to occur even after 6 months unless the crowdsale was finalized", async () => {
        const sixMonths = Math.floor(+ new Date() / 1000) + (86400 * 180) + 1; //6 months
        await vestedWallet.setMockedTime(sixMonths);

        await assertFail(async function() {
            await vestedWallet.collectTokens({from: foundationWallet});
        });

        //the foundation starts off with config.foundation.amount, but shouldn't receive any more tokens until after the tokens vest
        assert.equal(await token.balanceOf(foundationWallet), config.foundation.amount, "Vested tokens transferred before vested period began");
    });

    it("Should allow the transfer of some vested tokens six months after the crowdsale was finalized", async () => {
        await crowdsale.setMockedTime(endTime + 1);
        await crowdsale.finalize();
        const oneYear = (await crowdsale.finalizedTime()).toNumber() + (86400 * 360);

        await vestedWallet.setMockedTime(oneYear);
        await vestedWallet.collectTokens({from: foundationWallet});

        const totalSupply = await token.totalSupply.call();
        const balance = await token.balanceOf(foundationWallet);
        const teamOwned = config.team.amount / config.initialSupply; //percentage of totalSupply that the team (not foundation) owns

        //calculate how many tokens the foundation should have after one year
        //calculatedTokens = foundation initial amount + 50% of team's vested tokens
        const calculatedTokens = web3.fromWei(totalSupply.mul(teamOwned).mul(.50).add(config.foundation.amount)).toNumber();
        const realTokens = web3.fromWei(balance).toNumber();
        assert.equal(realTokens, calculatedTokens, "Tokens vested incorrectly");
    });
});