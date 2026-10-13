import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePosition,plotPaths,validPosition} from '../lib/map-coordinates.ts';
test('GeoJSON longitude/latitude is converted without reversing the location',()=>{
 const paths=plotPaths([{id:'p',name:'Talhao',kind:'talhao',boundary:{type:'Polygon',coordinates:[[[-47,-18],[-47.1,-18],[-47.1,-18.1],[-47,-18]]]}}]);
 assert.deepEqual(paths[0].paths[0][0],{lat:-18,lng:-47});
});
test('coordinate entry rejects invalid or missing positions and accepts zero',()=>{
 for(const [a,b] of [['91','0'],['0','181'],['NaN','0'],['','0']])assert.equal(parsePosition(a,b),null);
 assert.deepEqual(parsePosition('0','0'),{lat:0,lng:0});
 assert.deepEqual(parsePosition('-18,5','-47,2'),{lat:-18.5,lng:-47.2});
 assert.equal(validPosition(Infinity,0),false);
});
