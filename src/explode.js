import { 
    BufferGeometry,
    Float32BufferAttribute,
    PointsMaterial,
    Points,
    AdditiveBlending,
    TextureLoader,
    PositionalAudio,
    AudioLoader
} from './three.js';
import fireball from '../res/textures/fireball.png';
import explodemp3 from '../res/sounds/explode.mp3';

const texture = new TextureLoader().load( fireball );

class ExplodeSound{
    constructor(){
        this.waiting = [];
        const audioLoader = new AudioLoader();
        audioLoader.load( explodemp3, ( buffer ) => {
            this.explodeBuffer=buffer;
            var sound;
            while(sound = this.waiting.pop()){
                this.add(sound);
            }
        });
    }
    add(sound){
        if(!this.explodeBuffer){
            this.waiting.push(sound);
        }else{
            sound.setBuffer( this.explodeBuffer );
            sound.setRefDistance( 50 );
        }
    }
}
var explodeSound = new ExplodeSound;


export default class Explode{
    constructor(complete,listener){
        this.positions = [];
        this.count=150;
        for(var i = 0; i<this.count; i++){
            var dx = Math.random()-0.5;
            var dy = Math.random()-0.5;
            var dz = Math.random()-0.5;
            var d = Math.sqrt(dx*dx+dy*dy+dz*dz);
            this.positions.push(dx/d,dy/d,dz/d);
        }
        this.geometry = new BufferGeometry();
        this.geometry.setAttribute( 'position', new Float32BufferAttribute( this.positions, 3 ) );
        this.material = new PointsMaterial( { size: 10, map:texture,blending: AdditiveBlending,  depthTest: true, depthWrite: false, opacity: 0, transparent: false,color: 0x555555 } )
        var matShader;
        this.material.onBeforeCompile=shader=>{            
            shader.vertexShader = shader.vertexShader.replace("#include <common>",`
                uniform float uTime;
                #include <common>
            `);
            shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",`
                vec3 transformed = vec3( position*vec3(uTime*60.0) );
            `);
            shader.uniforms["uTime"]={value: 0};
            matShader=shader;
        };
        this.sound = new PositionalAudio( listener );
        explodeSound.add(this.sound);
        this.explode = new Points( this.geometry, this.material );
        this.explode.add(this.sound);
        this.explode.frustumCulled =false;
        //this.explode.renderOrder = 1500;
        this.explode.onBeforeRender=()=>{
            var delta = Math.min(1,(performance.now()-this.started)/2000);
            if(delta==1 && !this.done && complete){
                complete(this);
                this.done = true;
            }
            this.material.opacity = 1-Math.sqrt(delta);
            var c = Math.max(0,1-delta*5)
            this.material.color.setRGB(c,c,c);
            if(matShader) matShader.uniforms["uTime"].value=delta;
        }
    }
    start(size){
        if(size) this.material.size=size;
            else this.material.size = 10;

        this.sound.play();
        this.started=performance.now();
        this.done=false;
    }
}