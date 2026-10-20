const esbuild = require('esbuild');
esbuild.buildSync({entryPoints:['media/reviewed/source.js'], outfile:'media/reviewed/viewer.js', bundle:true,
    platform:'browser',format:'iife',target:'es2022',minify:false,legalComments:'eof',metafile:true,
    write:true});
