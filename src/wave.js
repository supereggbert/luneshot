import Baddies from './baddies.js';
import Baddies2 from './baddies2.js';
import Baddies3 from './baddies3.js';
import Ammo from './ammo.js';
import { 
    Vector3
} from './three.js';

export default class Wave{
    constructor(scene,loaded,listener){
        var loadedCnt = 0;
        this.badGroups=[
            new Baddies(scene,(baddies)=>{
                this.baddies=this.baddies.concat(baddies);
                loadedCnt++;
                if(loadedCnt == 3) loaded();
            }),
            new Baddies2(scene,(baddies)=>{
                this.baddies=this.baddies.concat(baddies);
                loadedCnt++;
                if(loadedCnt == 3) loaded();
            }),
            new Baddies3(scene,(baddies)=>{
                this.baddies=this.baddies.concat(baddies);
                loadedCnt++;
                if(loadedCnt == 3) loaded();
            })
        ];
        this.baddies = [];
        this.killCallbacks=[];
        this.ammo = new Ammo(scene,listener);
    }
    start(a){
        this.badGroups[0].setActive(a[0],a[3]);
        this.badGroups[1].setActive(a[1],a[4]);
        this.badGroups[2].setActive(a[2],a[5]);
        this.reset();
    }
    isdone(){
        for(let i =0; i<this.baddies.length;i++){
            if(this.baddies[i].active) return false;
        }
        return true;
    }
    onKill(fn){
        this.killCallbacks.push(fn);
    }
    update(dt, octree, mech, shields){
        var fired = [];


        var time = performance.now();
        var x1= Math.sin(time*0.0002)*100;
        var z1= Math.cos(time*0.0003)*100;

        var target = new Vector3(x1,150,z1);

        var x2= Math.sin(time*0.0004)*100;
        var z2= Math.cos(time*0.00035)*100;

        var target2 = new Vector3(x2,150,z2);

        var update = new Vector3();

        for(var i=0;i<this.baddies.length; i++){
            if(!this.baddies[i].active){
                continue;
            }
            var t = (i%2)==0?target:target2;
            update.copy(t).sub(this.baddies[i].position).multiplyScalar(1*dt/1000).clampLength(0,0.6);
            this.baddies[i].velocity.add(update);
            for(var j=i+1;j<this.baddies.length; j++){
                if(!this.baddies[j].active) continue;
                update.copy(this.baddies[i].position).sub(this.baddies[j].position);
                if(update.length()<(this.baddies[i].radius+this.baddies[j].radius)+20){
                    update.multiplyScalar(5*dt/1000).clampLength(0,0.6);
                    this.baddies[i].velocity.add(update);
                    this.baddies[j].velocity.sub(update);
                }
            }
            //force above base
            if(this.baddies[i].position.y<120) this.baddies[i].velocity.y+=0.005*dt*(120-this.baddies[i].position.y);

            this.baddies[i].velocity.clampLength(0,this.baddies[i].maxSpeed);

            update.copy(this.baddies[i].velocity).multiplyScalar(dt/1000);
            this.baddies[i].position.add(update);
        }


        for(let i=0;i<this.badGroups.length;i++){
            this.badGroups[i].update(dt,fired);
        }
        for(var i=0;i<fired.length;i++){
            var direction = mech.bones['body'].position.clone().sub(fired[i]).normalize();
            this.ammo.fire(fired[i], direction);
        }
        this.ammo.update(dt,octree,null,shields);
    }
    reset(){
        this.badGroups.forEach(el=>el.reset());
        this.ammo.reset();
    }
    doCollition(point, radius){
        for(let i=0;i<this.baddies.length;i++){
            if(!this.baddies[i].active) continue;
            var badRadius = this.baddies[i].radius;
            if(this.baddies[i].position.distanceTo(point)<radius+badRadius){
                this.baddies[i].health--;
                if(this.baddies[i].health==0){
                    this.baddies[i].active=false;
                    this.killCallbacks.forEach(fn=>fn(this.baddies[i]));
                }
                return {position: this.baddies[i].position, distance:0, size: this.baddies[i].radius};
            }
        }
        return false;
    }
}