'use strict';
const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const spawn = require('cross-spawn');

// stream info
let Transform = require('stream').Transform;
function StreamInfo() {
    Transform.call(this);
    this._info = [];
}
util.inherits(StreamInfo, Transform);
StreamInfo.prototype._transform = function(chunk, enc, callback) {
    let buf = chunk instanceof Buffer ? chunk : new Buffer(chunk, enc);
    this._info.push(buf);
    this.push(buf);
    callback();
}
StreamInfo.prototype.destroy = function() {
    this._info.length = 0;
};
StreamInfo.prototype.getCache = function() {
    return Buffer.concat(this._info);
};

// git opt
let deployFunc = {
    init: function(options) {
        let args = options.deploy[0];
        let deployDir = path.join(process.cwd(), '.deploy_git');
        let publicDir = path.resolve(process.cwd(), options.output_dir);
        let message = args.msg || args.message || 'update';
        let repoInfo = {
            url: args.repo || args.repository,
            branch: args.branch || 'master'
        };
        if (!args.repo && !args.repository) {
            console.log('please check _config.yml.');
            return;
        }
        function git() {
            let len = arguments.length;
            let gitArgs = new Array(len);
            for (let i = 0; i < len; i++) {
                gitArgs[i] = arguments[i];
            }
            let task = spawn('git', gitArgs, {
                cwd: deployDir
            });
            let encoding = 'utf8';
            let stderrCache = new StreamInfo();
            let stdoutCache = new StreamInfo();
            if (task.stdout) {
                let stdout = task.stdout.pipe(stdoutCache);
                stdout.pipe(process.stdout);
            }
            if (task.stderr) {
                let stderr = task.stderr.pipe(stderrCache);
                stderr.pipe(process.stderr);
            }
            task.on('close', function(code) {
                if (code) {
                    getCache(stderrCache, encoding);
                }
                getCache(stdoutCache, encoding);
            });
            function getCache(stream, encoding) {
                let buf = stream.getCache();
                stream.destroy();
            }
        }
        function setup() {
            let userName = args.name || '';
            let userEmail = args.email || '';
            fs.mkdirSync(deployDir);
            fs.writeFileSync(path.join(deployDir, 'placeholder'), '', 'utf8');
            git('init');
            userName && git('config', 'user.name', userName);
            userEmail && git('config', 'user.email', userEmail);
            git('add', '-A');
            git('commit', '-m', 'First commit');
        }
        function push() {
            git('add', '-A');
            git('commit', '-m', message);
            git('push', '-u', repoInfo.url, 'HEAD:' + repoInfo.branch, '--force');
        }
        if (!fs.existsSync(deployDir)) {
            setup();
        }
        try {
            fs.emptydirSync(deployDir);
        } catch (ex) {}
        fs.copySync(publicDir, deployDir);
        push();
    }
};
module.exports = deployFunc;
