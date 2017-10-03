module.exports = async function(callback) {
    let web3_error_thrown = false;
    try {
        await callback();
    } catch (error) {
        if (error.message.search("invalid opcode")) web3_error_thrown = true;
    }
    assert.equal(web3_error_thrown, true, "Transaction should fail");
};