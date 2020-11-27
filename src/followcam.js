import { 
    PerspectiveCamera,
    Vector3,
    Sphere,
    AudioListener
} from './three.js'


export default class FollowCam{
    constructor(worldmap){
        this.camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.camera.rotation.y=3.141;
        this.position = new Vector3;
        this.lookTarget = new Vector3; 
        this.mouseTarget = new Vector3; 
        this.collideSphere = new Sphere(new Vector3, 3);
        this.worldmap=worldmap;
        this.wobble = 0;
        this.velocity = new Vector3();

        this.listener = new AudioListener();
        this.camera.add( this.listener );
    }
    checkCollisions(){
        var res = this.worldmap.octree.sphereIntersect(this.collideSphere);
        
        if(res.length>0){
            for(var i = 0;i<res.length;i++){
                this.position.add(res[i].normal.clone().multiplyScalar(res[i].depth));
            }
        }
    }
    hit(wobble){
        this.wobble = Math.min(1,this.wobble+wobble);
    }
    reset(){
        this.lookTarget.set(35.29628577081308, 99.62703636944892, 2.995169058746783);
        this.position.set(-161.45204978561077, 64.64728053331146, 2.7962552383270567);
        this.camera.position.copy(this.position);
        this.camera.lookAt(this.lookTarget);
    }
    update( target, mouseTarget, dt ){
        this.wobble=Math.max(0,this.wobble-this.wobble*dt/300);
        var lookTarget = this.mouseTarget.copy(mouseTarget).unproject(this.camera)
                    .sub(this.camera.position).normalize();
        const newPosition = lookTarget.clone().multiplyScalar(-15);
        newPosition.y+=7;
        newPosition.add(target.position);

        var damping = 0.04;
        this.velocity.multiplyScalar(1-dt*damping);
        this.velocity.add(newPosition.sub(this.position).multiplyScalar(dt/1000*0.1));
        this.position.add(this.velocity.clone().multiplyScalar(dt).clampLength(-3.5,3.5));
        //do hit wobble
        this.position.x+=(Math.random()-0.5)*this.wobble;
        this.position.y+=(Math.random()-0.5)*this.wobble;
        this.position.z+=(Math.random()-0.5)*this.wobble;

        var delta = Math.max(0,20 - dt/1000*20)*5;

        lookTarget.multiplyScalar(200).add(this.camera.position);
        //lookTarget.y=Math.min(target.position.y+50,lookTarget.y);
        //lookTarget.y=Math.max(target.position.y-1,lookTarget.y);

        this.lookTarget.multiplyScalar(delta).add(lookTarget).multiplyScalar(1/(delta+1));

        this.collideSphere.center.copy(this.position);
        this.checkCollisions();

        this.camera.position.copy(this.position);

        this.camera.lookAt(this.lookTarget);


    }
}