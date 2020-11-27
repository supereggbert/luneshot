import { 
    BufferGeometry,
    Float32BufferAttribute,
    PointsMaterial,
    Points,
    AdditiveBlending,
    TextureLoader,
    Vector3,
    AudioLoader,
    PositionalAudio,
    Ray
} from './three.js';
import Explode from './explode.js';
import plasma from '../res/textures/plasma.png';
import blastmp3 from '../res/sounds/blast.mp3';

const texture = new TextureLoader().load( plasma );



class BlastSound{
    constructor(){
        this.waiting = [];
        const audioLoader = new AudioLoader();
        audioLoader.load( blastmp3, ( buffer ) => {
            this.blastBuffer=buffer;
            var sound;
            while(sound = this.waiting.pop()){
                this.add(sound);
            }
        });
    }
    add(sound){
        if(!this.blastBuffer){
            this.waiting.push(sound);
        }else{
            sound.setBuffer( this.blastBuffer );
            sound.setRefDistance( 50 );
        }
    }
}
var blastSound = new BlastSound;

export default class Ammo{
    constructor(scene,listener){
        this.scene = scene;
        this.ray = new Ray;
        this.active = [];
        this.ready = [];
        this.positions=[];
        this.directions=[];
        this.explodeCallbacks=[];
        this.sounds=[];
        this.count = 50;
        for(var i = 0; i<this.count; i++){
            this.positions.push(0,0,0);
            this.directions.push(1,1,1);
            this.ready.push(i);
            var sound = new PositionalAudio( listener );
            blastSound.add(sound);
            this.sounds.push(sound);
        }
        this.geometry = new BufferGeometry();
        this.geometry.setAttribute( 'position', new Float32BufferAttribute( this.positions, 3 ) );
        this.material = new PointsMaterial( { size: 2, map:texture,blending: AdditiveBlending, depthTest: true, transparent: true,color: 0xffffff } )
        this.ammo = new Points( this.geometry, this.material );
        this.ammo.frustumCulled =false;
        scene.add(this.ammo);

        this.explodePool=[];
        this.explodes=[];
        for(var i=0;i<20;i++){
            var explode = new Explode(this.explodeDone.bind(this),listener);
            this.explodePool.push(explode);
            this.explodes.push(explode);
        }
        

    }
    onExplode(fn){
        this.explodeCallbacks.push(fn);
    }
    explodeDone(explode){
        this.scene.remove(explode);
        this.explodePool.push(explode);
    }
    reset(){
        this.explodes.forEach(explode=>explode.started=0);
        
        this.ready = [];
        this.active=[];
        for(var i = 0; i<this.count; i++){
            this.ready.push(i);
        }
        var position = this.geometry.attributes.position.array;
        for(var i=0;i<position.length;i++) position[i]=0;
        this.geometry.attributes.position.needsUpdate = true;
    }
    update(dt,octree, wave, shields){
        var positions = this.geometry.attributes.position.array;
        var newActive = [];
        for(var i=0;i<this.active.length;i++){
            var idx = this.active[i]*3;
            positions[idx]+=this.directions[idx]*4;
            positions[idx+1]+=this.directions[idx+1]*4;
            positions[idx+2]+=this.directions[idx+2]*4;
            var result;
            if(wave){
                this.ray.origin.set(positions[idx],positions[idx+1],positions[idx+2]);
                var result = wave.doCollition(this.ray.origin, 5);
            }
            if(shields){
                this.ray.origin.set(positions[idx],positions[idx+1],positions[idx+2]);
                var result = shields.doCollition(this.ray.origin);
            }
            if(octree && !result){
                this.ray.origin.set(positions[idx],positions[idx+1],positions[idx+2]);
                this.ray.direction.set(this.directions[idx],this.directions[idx+1],this.directions[idx+2]);
                result=octree.rayIntersect(this.ray);
            }
            if(Math.abs(positions[idx])+Math.abs(positions[idx+1])+Math.abs(positions[idx+2])>1000 || (result && result.distance<4)){
                this.ready.push(this.active[i]);
                positions[idx]=0;
                positions[idx+1]=0;
                positions[idx+2]=0;
                if(result && result.distance<4){
                    var explode = this.explodePool.pop();
                    if(explode){
                        this.explodeCallbacks.forEach(fn=>fn(result.position));
                        explode.start(result.size);
                        explode.explode.position.copy(result.position);
                        this.scene.add(explode.explode);
                    }
                }
            }else{
                newActive.push(this.active[i]);
            }
        }
        this.active = newActive;
        this.geometry.attributes.position.needsUpdate = true;
    }
    fire(position, direction){
        if(this.ready.length==0) return;
        var positions = this.geometry.attributes.position.array;
        var directions = this.directions;
        var i = this.ready.pop();
        var sound = this.sounds[i];
        this.active.push(i);
        var idx = i*3;
        sound.position.copy(position);
        sound.play();
        positions[idx] = position.x;
        positions[idx+1] = position.y;
        positions[idx+2] = position.z;
        directions[idx] = direction.x;
        directions[idx+1] = direction.y;
        directions[idx+2] = direction.z;
    }

}