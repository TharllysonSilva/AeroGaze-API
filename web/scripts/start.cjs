const {spawn}=require('node:child_process');
const path=require('node:path');
const child=spawn(process.execPath,[path.join(__dirname,'../node_modules/next/dist/bin/next'),'start','-H','0.0.0.0','-p',process.env.PORT||'3001'],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
