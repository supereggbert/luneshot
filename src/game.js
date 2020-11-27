import { 
    Scene, 
    Color, 
    WebGLRenderer, 
    Vector3,
    Box3,
    PCFSoftShadowMap,
    ShaderChunk,
    FogExp2
} from './three.js'

import Mech from './mech.js';
import Sky from './sky.js';
import Ammo from './ammo.js';
import Wave from './wave.js';
import Shields from './shields.js';
import WorldMap from './worldmap.js';
import FollowCam from './followcam.js';
import Hud from './hud.js';
import cursor1png from '../res/images/cursor1.png';
import cursor2png from '../res/images/cursor2.png';



ShaderChunk['fog_vertex']=ShaderChunk['fog_vertex'].replace("fogDepth = - mvPosition.z","fogDepth = length(mvPosition)");

ShaderChunk['shadowmap_pars_fragment']=ShaderChunk['shadowmap_pars_fragment'].replace("return shadow;",`
#if defined( STATIC_SHADOW )
#if defined( STATIC_SHADOW_UV2 )
    shadow = min(texture2D( shadowStaticMap, vUv2 ).x,shadow);
#else
    shadow = min(texture2D( shadowStaticMap, vUv ).x,shadow);  
#endif
#endif

return shadow;
`);
ShaderChunk['shadowmap_pars_fragment']=ShaderChunk['shadowmap_pars_fragment'].replace("#ifdef USE_SHADOWMAP",`
#ifdef USE_SHADOWMAP
uniform sampler2D shadowStaticMap;
`);
ShaderChunk['uv2_pars_fragment']=`
#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP ) || defined( STATIC_SHADOW_UV2 )
	varying vec2 vUv2;
#endif
`;
ShaderChunk['uv2_vertex']=`
#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP ) || defined( STATIC_SHADOW_UV2 )
    vUv2 = uv2;
#endif
`;
ShaderChunk['uv2_pars_vertex']=`
#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP ) || defined( STATIC_SHADOW_UV2 )
	attribute vec2 uv2;
	varying vec2 vUv2;
	uniform mat3 uv2Transform;
#endif
`;

export const LOADING = 0;
export const TITLE = 1;
export const PLAYING = 2;
export const PAUSED = 3;
export const GAMEOVER = 4;

export class Game{
    constructor(){
        this.stateEvents = [];

        this.state = LOADING;
        this.waveCount = 0;
        this.waveTimer=false;
        this.waves =[
            [10,0,0,0.01,0.1,0.2],
            [15,2,0,0.01,0.1,0.2],
            [30,4,0,0.01,0.1,0.2],
            [50,5,0,0.03,0.1,0.2],
            [60,2,1,0.03,0.1,0.2],
            [70,4,1,0.04,0.1,0.2],
            [70,10,2,0.04,0.1,0.2],
            [90,10,3,0.04,0.1,0.2],
            [120,20,3,0.04,0.1,0.2],
            [150,20,20,0.05,0.2,0.3]
        ];
        this.charge=1;
        this.armour=1;
        this.score=0;

        this.pointerCanvas = document.createElement("canvas");
        this.pointerCanvas.width=64;
        this.pointerCanvas.height=64;
        this.pointerCanvas.style.position = "absolute";
        this.pointerCanvas.style.transform = "translate(-50%,-50%)";
        document.body.append(this.pointerCanvas); 
        this.pointerCtx = this.pointerCanvas.getContext("2d");
        this.cursorImg1 = new Image;
        this.cursorImg1.src=cursor1png;
        this.cursorImg2 = new Image;
        this.cursorImg2.src=cursor2png;
        this.fireScale=0;

        var scene = new Scene();
        scene.background = new Color( 0x444444 );
        scene.fog = new FogExp2( 0xeeeeff, 0.0020 );
        this.scene = scene;

        
        this.hud = new Hud();
        
        var renderer = new WebGLRenderer( { antialias: true } );
        this.sky = new Sky( renderer, scene );
        renderer.setPixelRatio( 1 );
        renderer.setSize( window.innerWidth, window.innerHeight );
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = PCFSoftShadowMap;
        document.body.appendChild( renderer.domElement );
        this.renderer = renderer;

        window.addEventListener( 'resize', ()=>{
            if(this.cam){
                var camera = this.cam.camera
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
            }

            renderer.setSize( window.innerWidth, window.innerHeight );
        }, false );

        this.worldmap = new WorldMap(()=>{
            scene.add(this.worldmap.mesh);
            this.cam = new FollowCam(this.worldmap);
            this.mech = new Mech(this.worldmap, this.cam);
            this.ammo = new Ammo(scene,this.cam.listener);
            window.cam = this.cam; //TODO remove
            this.mech.onInit(()=>{
                scene.add(this.mech.model); 
                window.mech=this.mech;//TODO remove
                this.mech.reset();
                this.cam.reset();
                this.wave = new Wave(scene,()=>{
                    this.wave.onKill((baddie)=>{
                        this.score += Math.floor(baddie.score/(this.charge+1));
                    });
                    this.wave.ammo.onExplode(this.enemyHit.bind(this));
                    this.shields = new Shields(scene,()=>{
                        this.setState(TITLE);
                    });  
                },this.cam.listener);
            })
        })
        this.setupKeys();
        this.setupMouse();
        this.mainloop();
    }
    updateCursor(){
        var time = performance.now();
        var angle = time*0.003;
        this.pointerCtx.clearRect(0,0,64,64);
        this.pointerCtx.save();
        this.pointerCtx.translate(32,32);
        this.fireScale*=0.9;
        var outscale = this.fireScale*0.5+0.5;
        this.pointerCtx.rotate(angle);
        this.pointerCtx.scale(outscale,outscale);
        this.pointerCtx.translate(-32,-32);
        this.pointerCtx.drawImage(this.cursorImg2,0,0);
        this.pointerCtx.restore();
        this.pointerCtx.save();
        this.pointerCtx.translate(32,32);
        this.pointerCtx.rotate(-angle*0.5);
        var scaleCharge = this.charge*0.5+0.5;
        this.pointerCtx.scale(scaleCharge,scaleCharge);
        this.pointerCtx.translate(-32,-32);
        this.pointerCtx.drawImage(this.cursorImg1,0,0);
        this.pointerCtx.restore();
        this.pointerCanvas.style.left=(this.mouseTarget.x+1)*0.5*innerWidth+"px";
        this.pointerCanvas.style.top=(1-this.mouseTarget.y)*0.5*innerHeight+"px";
    }
    enemyHit(position){
        var damage = 1.0-Math.min(1,this.mech.bones['body'].position.distanceTo(position)/10);
        this.cam.hit(damage);
        this.mech.velocity.z+=(Math.random()-0.5)*100*damage;
        this.mech.velocity.x+=(Math.random()-0.5)*100*damage;
        this.armour = Math.max(0,this.armour -damage*0.1);
    }
    stateChange(fn){
        this.stateEvents.push(fn);
    }
    setupKeys(){
        var keyStates = {};
        document.addEventListener("keydown",(e)=>{
            keyStates["shift"]= e.shiftKey;
            keyStates[e.keyCode]=true;
        })
        document.addEventListener("keyup",(e)=>{
            keyStates["shift"]= e.shiftKey;
            keyStates[e.keyCode]=false;
        });
        this.keyStates = keyStates;
    }
    reset(){
        this.waveCount = 0;
        this.charge=1;
        this.armour=1;
        this.score = 0;
        if(this.waveTimer){
            clearTimeout(this.waveTimer);
            this.waveTimer = false;
        }
        if(this.fireTimer){
            clearTimeout(this.fireTimer);
            this.fireTimer=false;
        }
        this.mech.reset();
        this.cam.reset();
        this.wave.reset();
        this.shields.reset();
        this.ammo.reset();
        this.setState(TITLE);
    }
    continue(){
        var cnt=this.waveCount;
        this.reset();
        this.waveCount=cnt-1;
        this.nextWave();
        this.setState(PLAYING);
    }
    setupMouse(){
        this.mouseStates = {};
        this.fireTimer = false;
        this.fireLeft = true;
        document.addEventListener('pointerlockchange', ()=>{
            if(document.pointerLockElement !== document.body && this.state==PLAYING){
                this.setState(PAUSED);
            }
        }, false);
        document.addEventListener('pointerlockerror', (e)=>{
            document.body.requestPointerLock();
        }, false);
        document.addEventListener("mousedown",(e)=>{
            this.mouseStates[e.button]=true;
            return false;
        });
        document.addEventListener("mouseup",(e)=>{
            this.mouseStates[e.button]=false;
        });
        document.addEventListener("dragstart",(e)=>{
            e.preventDefault();
            e.stopPropagation();
            return false;
        });

        this.mouseTarget=new Vector3(0,0,-1);
        document.body.addEventListener("mousemove",(e)=>{
            if(this.state == PLAYING){
                //this.mouseTarget.x=(e.clientX/innerWidth-0.5)*2;
                //this.mouseTarget.y=(0.5-e.clientY/innerHeight)*2;
                this.mouseTarget.x=Math.min(1,Math.max(-1,this.mouseTarget.x+e.movementX/500));
                this.mouseTarget.y=Math.min(1,Math.max(-1,this.mouseTarget.y-e.movementY/500));
            }
        })
    }
    fire(){
        if(this.fireTimer) return;
        this.fireTimer = setTimeout(()=>{
            if(this.state == PLAYING){
                if(this.charge>=0){
                    this.charge = this.charge-0.05;
                }else{
                    this.charge+=0.025;
                }
                if(this.charge<-0.025){
                    this.fireTimer = false;
                    return;
                }
                var ammo = this.ammo;
                var mech = this.mech;
                var cam = this.cam;
                var obj = this.fireLeft?mech.bones['armbottomL']:mech.bones['armbottomR'];
                var position = new Vector3(0,0,-1.5);
                position.applyMatrix4(obj.matrixWorld);
                var direction = cam.mouseTarget.clone().sub(position).normalize();
                ammo.fire(position, direction);
                this.fireLeft=!this.fireLeft;
                mech.fire(this.fireLeft);
                this.fireTimer = false;
                this.fireScale=1;
            }
        },50);
    }
    calcShadowBound(){
        var dirLight = this.sky.sunLight;
        var transform = this.cam.camera.projectionMatrixInverse.clone() 
                    .premultiply(cam.camera.matrixWorld).premultiply(dirLight.shadow.camera.matrixWorldInverse);
    
        var far = new Vector3(0,0,-30).applyMatrix4( cam.camera.projectionMatrix );
    
        var vecs = [
            new Vector3(-1,-1,-1),
            new Vector3(1,-1,-1),
            new Vector3(-1,1,-1),
            new Vector3(1,1,-1),
            new Vector3(-1,-1,far.z),
            new Vector3(1,-1,far.z),
            new Vector3(-1,1,far.z),
            new Vector3(1,1,far.z)
        ];
        var bound = new Box3(new Vector3(1000,1000,0),new Vector3(-1000,-1000,0));
        vecs.forEach(vec=>{
            vec.applyMatrix4(transform);
            bound.max.max(vec);
            bound.min.min(vec);
        })
        
        dirLight.shadow.camera.right = bound.max.x;
        dirLight.shadow.camera.left = bound.min.x;
        dirLight.shadow.camera.top	= bound.max.y;
        dirLight.shadow.camera.bottom = bound.min.y;
        dirLight.shadow.camera.updateProjectionMatrix();
    }
    setState(state){
        this.state = state;
        if(state==PLAYING){
            document.body.requestPointerLock();
        }else{
            document.exitPointerLock();
        }
        this.stateEvents.forEach(el=>el(state));
    }
    start(){
        this.reset();
        this.nextWave();
        this.setState(PLAYING);
    }
    processControls(dt){
        var speed = dt/1000;
        var mech = this.mech;
        var keyStates = this.keyStates;
        
        if(mech.jumpHeight==0){
            var walkspeed=keyStates["shift"]?2.3:1.5;

            if(keyStates[27]){
                this.setState(PAUSED);
            }
            var charging = false;
            if(keyStates[69]){
                var shield=this.shields.isNear(this.mech.bones['body'].position);
                if(shield && this.charge>0){
                    var inc = (this.charge*0.1);
                    this.charge-=inc;
                    shield.strengh=Math.min(1,shield.strengh+inc*0.3);
                    charging = true;
                }
            }

            if(keyStates[39]){
                mech.transform.rotation.y-=speed*walkspeed;
            }
            if(keyStates[87]){
                mech.velocity.z+=0.3*speed*walkspeed;
                mech.velocity.z=Math.max(8*walkspeed,mech.velocity.z);
            }
            if(keyStates[83]){
                mech.velocity.z-=0.3*speed*walkspeed;
                mech.velocity.z=Math.min(-8*walkspeed,mech.velocity.z);
            }
            if(keyStates[37]){
                mech.transform.rotation.y+=speed*walkspeed;
            }
            if(keyStates[65]){
                mech.velocity.x+=0.3*speed*walkspeed;
                mech.velocity.x=Math.max(8,mech.velocity.x);
            }
            if(keyStates[68]){
                mech.velocity.x-=0.3*speed*walkspeed;
                mech.velocity.x=Math.min(-8,mech.velocity.x);
            }
            if(keyStates[32]){
                mech.jump();
            }
            if(this.mouseStates[0] && !charging){
                this.fire();
            }
        }
    }
    nextWave(){
        this.wave.start(this.waves[this.waveCount]);
        this.waveCount= (this.waveCount+1) % this.waves.length;
        this.hud.showWave(this.waveCount);
        this.waveTimer = false;
    }
    mainloop(){
        var time = performance.now(dt);

        if(this.state == PLAYING){
            this.hud.updateScore(this.score);
            if(!window.localStorage.highScore || this.score>window.localStorage.highScore){
                window.localStorage.highScore = this.score;
            }
            this.hud.updateHighScore(window.localStorage.highScore);

            if(this.wave.isdone()&& !this.waveTimer){
                this.waveTimer=setTimeout(this.nextWave.bind(this),5000);
            }
            var dt = Math.min(30,time-this.lastTime);
            
            this.mouseTarget.x-=this.mouseTarget.x*Math.min(1,dt/1000);
            this.mouseTarget.y-=this.mouseTarget.y*Math.min(1,dt/1000);

            this.charge=Math.min(1,this.charge+dt/5000);
            this.hud.updateMech(Math.max(0,this.charge),this.armour);

            if(this.armour==0) this.setState(GAMEOVER);

            this.hud.chargeShield(this.shields.isNear(this.mech.bones['body'].position));

            this.processControls(dt);

            var direction = this.cam.mouseTarget.clone().sub(this.mech.bones['body'].position);
            var angle = Math.atan2(direction.x,direction.z);
            this.mech.transform.rotation.y=angle;
            this.hud.updateCompas(angle/Math.PI);

            this.hud.updateShield(this.shields.shields[0].strengh,this.shields.shields[1].strengh,this.shields.shields[2].strengh);

            this.mech.update(dt);
            this.cam.update(this.mech.bones['body'],this.mouseTarget,dt);

            
            this.wave.update(dt,this.worldmap.octree,this.mech,this.shields);
            this.ammo.update(dt,this.worldmap.octree,this.wave);
            
            this.hud.updateWave(this.waveCount-1,this.waves.length);

            this.shields.update(dt);

            this.updateCursor();

            this.calcShadowBound();

            this.renderer.render( this.scene, this.cam.camera );
        }
        this.lastTime = time;


        requestAnimationFrame( this.mainloop.bind(this) );
        
        
    }
}