import { 
    Vector3,
    Quaternion,
    Box3,
    PointLight,
    Object3D,
    Ray,
    Sphere,
    GLTFLoader

} from './three.js';

import mechglb from '../res/models/mech.glb';

const INIT = 0;
const READY = 1;


class Step{
    constructor(target,phase,footBone,stepCallback){
        this.length=400;
        this.stepTime = 400;
        this.targetStepTime = 300;
        this.time=phase*(this.length+this.stepTime);
        this.start=target.clone();
        this.end=target;
        this.target=target;
        this.current = target.clone();
        this.phase = phase;
        this.footBone = footBone;
        this.speed= 0;
        this.lastTime=0;
        this.stomp=0.6;
        this.stepCallback = stepCallback;
        this.footFallSpeed = 0;
    }
    nextStep(){
        this.start.copy(this.end);
        this.end=this.target;
        this.stepCallback();
    }
    setSpeed(speed){
        this.targetStepTime=201 - Math.min(1,speed)*200;
        this.speed = speed;
    }
    update(dt, offsetY){
        var speed= this.speed;

        var stepDelta = (this.stepTime - this.targetStepTime)
        var newStep = this.stepTime - Math.max(-Math.abs(stepDelta), Math.min(Math.abs(stepDelta), stepDelta*dt*0.002));
        this.time = this.time / (this.length+this.stepTime) * (this.length+newStep);
        this.stepTime = newStep;
        var originalHeight = this.current.position.y

        this.time+=dt*speed;
        var time =this.time % (this.length+this.stepTime);
        if(time<this.lastTime){
            this.nextStep();
        }
        this.lastTime = time;

        var delta=Math.min(1,time/this.length);
        this.current.position.copy(this.end.position).sub(this.start.position).multiplyScalar(delta).add(this.start.position);

        var height = this.end.position.distanceTo(this.start.position)*0.15;

        this.current.position.y+=(1-Math.pow(Math.abs((delta*delta-0.5)*2),this.stomp+1))*height+offsetY;
        if(delta==1 && this.end===this.target) this.end=this.target.clone();

        this.current.quaternion.copy(this.start.quaternion).slerp(this.end.quaternion,delta);
        var original = this.footBone.parent.getWorldQuaternion(new Quaternion).multiply(this.footBone.initalQuaternion);
        
        //limit foot speed
        var heightDelta = this.current.position.y-originalHeight;
        if(heightDelta<-0.5 || this.footFallSpeed>0){
            this.footFallSpeed-=0.0001*dt;
            this.current.position.y = (originalHeight+this.footFallSpeed*dt);
        }else{
            this.footFallSpeed = 0;
        }

        //fix feet start position to account for jumping
        if(Math.abs(this.footFallSpeed)>0) this.start.position.y=this.target.position.y;
    }
}

class DampedMotion{
    constructor(bounce, damping, maxSpeed, maxAcc, maxDistance){
        this.velocity=new Vector3;
        this.bounce = bounce;
        this.damping = damping;
        this.maxSpeed = maxSpeed;
        this.maxAcc = maxAcc;
        this.maxDistance = maxDistance;
    }
    update(target,position,dt){
        dt=dt/1000;
        position.sub(target).clampLength( 0, this.maxDistance ).add(target);

        var d = target.distanceTo( position );

        target.sub(position);
        this.velocity.multiplyScalar(1-dt*this.damping);

        var acc = target.multiplyScalar(d*d/dt*this.bounce).clampLength( 0, this.maxAcc );
        this.velocity.add(acc);

        this.velocity.clampLength( 0, this.maxSpeed );

        position.add(this.velocity.clone().multiplyScalar(dt));

    }
}

export default class Mech{
    constructor(worldmap, camera){
        this.worldmap=worldmap;
        this.camera = camera;
        this.transform = new Object3D;
        this.state = INIT;
        this.readyEvents = [];
        this.ikGroups = {};
        this.leftFootTarget = new Object3D;
        this.rightFootTarget = new Object3D;
        this.leftFootTarget.position.y=70;
        this.rightFootTarget.position.y=70;
        this.colideSphere = new Sphere(this.transform.position.clone(), 3.5);
        
        this.bodyPosition= new DampedMotion(0.2,12,20,20,1);
        this.bodyPositionCurrent = new Vector3;
        this.bodyLookRotation = new DampedMotion(0.1,10,25,25,50);
        this.bodyLookRotationCurrent = new Vector3;
        this.bodyUpRotation = new DampedMotion(0.2,10,30,30,20);
        this.bodyUpRotationCurrent = new Vector3;

        this.headUpRotation = new DampedMotion(0.1,20,10,20,2);
        this.headUpRotationCurrent = new Vector3;
        this.headLookRotation = new DampedMotion(0.05,10,50,50,50);
        this.headLookRotationCurrent = new Vector3;

        this.velocity=new Vector3;
        this.jumpVelocity = 0;
        this.gravity=0.08;
        this.jumpHeight = 0;
        this.lastSep = 0;

        this.limits = {
            "body": new Box3( new Vector3(-Math.PI*2,-Math.PI*2,-Math.PI*2),new Vector3(Math.PI*2,Math.PI*2,Math.PI*2) ),
            "legtopL": new Box3( new Vector3(-Math.PI*2,-0.5,-0.3),new Vector3(Math.PI*2,0.5,0.1) ),
            "legpivotL": new Box3( new Vector3(0,0,0),new Vector3(0,0,0) ),
            "legbottomL": new Box3( new Vector3(0,0,0),new Vector3(Math.PI*2,0,0) ),
            "legtopR": new Box3( new Vector3(-Math.PI*2,-0.5,-0.1),new Vector3(Math.PI*2,0.5,0.3) ),
            "legpivotR": new Box3( new Vector3(0,0,0),new Vector3(0,0,0) ),
            "legbottomR": new Box3( new Vector3(0,0,0),new Vector3(Math.PI*2,0,0) ),
            "neck": new Box3( new Vector3(0,-Math.PI*2,0),new Vector3(0,Math.PI*2,0) ),
            "head": new Box3( new Vector3(-0.2,-0.2,-0.2),new Vector3(0.2,0.2,0.2) ),
            "armtopL": new Box3( new Vector3(-Math.PI*0.5,0,0),new Vector3(Math.PI*0.5,0,0) ),
            "armbottomL": new Box3( new Vector3(-0,-0,-Math.PI*2),new Vector3(0,0,Math.PI*2) ),
            "armtopR": new Box3( new Vector3(-Math.PI*0.5,0,0),new Vector3(Math.PI*0.5,0,0) ),
            "armbottomR": new Box3( new Vector3(-0,-0,-Math.PI*2),new Vector3(0,0,Math.PI*2) )
        }
        
        this.stiffness = {
            "body": 0.0,
            "legtopL": 0,
            "legpivotL": 0,
            "legbottomL": 0,
            "legtopR": 0,
            "legpivotR": 0,
            "legbottomR": 0,
            "neck": 0.9,
            "head": 0,
            "armtopL": 0.0,
            "armbottomL": 0,
            "armtopR": 0.0,
            "armbottomR": 0
        }
        this.footPosition=new Vector3(0,1.877,0);
        this.bones={};
        this.steppedEvent = [];
        this.init();
    }
    stepped(){
        var callback;
        while(callback = this.steppedEvent.pop()) callback();
    }
    onInit(f){
        this.readyEvents.push(f);
    }
    init(){
        var loader = new GLTFLoader().setPath( './' );

        var bones=this.bones;
        loader.load( mechglb, ( gltf ) => {
            gltf.scene.traverse( ( child ) => {
                child.castShadow=true;
                child.frustumCulled =false;
                //child.renderOrder = 1000;
                if ( child.type=="Bone" ) {
                    bones[child.name]=child;
                    child.initalRotation = child.rotation.clone();
                    child.initalQuaternion = child.quaternion.clone();
                    child.updateMatrixWorld(true);
                }
            } );
            
            this.model = gltf.scene;
            this.bones = bones;

            this.ikGroups['leftLegBones']=[
                bones['legtopL'],
                bones['legpivotL'],
                bones['legbottomL']
            ]

            this.ikGroups['leftArmBones']=[
                bones['armtopL'],
                bones['armbottomL']
            ]

            this.ikGroups['rightLegBones']=[
                bones['legtopR'],
                bones['legpivotR'],
                bones['legbottomR']
            ]

            this.ikGroups['rightArmBones']=[
                bones['armtopR'],
                bones['armbottomR']
            ]

            this.ikGroups['dirBones']=[
                bones['body']
            ]

            this.ikGroups['headBones']=[
                bones['neck'],
                bones['head']
            ]

            //temp
            bones['body'].position.y+=0.5;
            bones['body'].rotation.set(0,0,0);
            bones['body'].initalRotation=bones['body'].rotation.clone();

            this.firelight = new PointLight( 0x8888ff, 0, 100, 2 );
            this.firelight.position.set( 0, 0, 3 );
            bones['body'].add( this.firelight );


            this.leftFoot= new Step(this.leftFootTarget,0,bones['padL'],this.stepped.bind(this));
            this.rightFoot = new Step(this.rightFootTarget,0.5,bones['padR'],this.stepped.bind(this));
            this.leftFoot.name = "Left Foot";
            this.rightFoot.name = "Right Foot";

            
            this.pistons =[
                [bones['neck1p1'],bones['neck1p2']],
                [bones['neck2p1'],bones['neck2p2']],
                [bones['neck3p1'],bones['neck3p2']],
                [bones['hip1p1L'],bones['hip1p2L']],
                [bones['hip2p1L'],bones['hip2p2L']],
                [bones['hip3p1L'],bones['hip3p2L']],
                [bones['hip1p1R'],bones['hip1p2R']],
                [bones['hip2p1R'],bones['hip2p2R']],
                [bones['hip3p1R'],bones['hip3p2R']],
                [bones['legp1L'],bones['legp2L']],
                [bones['legp1R'],bones['legp2R']],
                [bones['toe1p1L'],bones['toe1p2L']],
                [bones['toe2p1L'],bones['toe2p2L']],
                [bones['toe3p1L'],bones['toe3p2L']],
                [bones['toe4p1L'],bones['toe4p2L']],
                [bones['toe1p1R'],bones['toe1p2R']],
                [bones['toe2p1R'],bones['toe2p2R']],
                [bones['toe3p1R'],bones['toe3p2R']],
                [bones['toe4p1R'],bones['toe4p2R']]
            ];
            this.pVector1 = new Vector3();
            this.pQuat1 = new Quaternion();
            this.pVector2 = new Vector3();
            this.pQuat2 = new Quaternion();
            this.pUp = new Vector3(0,-1,0);
            //this.pUp2 = new Vector3(0,0,1);
            

            this.state = READY;
            var callback;
            while(callback=this.readyEvents.pop()) callback();
        } );
    }
    solvePiston(){
        for(var i=0;i<this.pistons.length;i++){
            var p1 = this.pistons[i][0];
            var p2 = this.pistons[i][1];
            p1.getWorldPosition(this.pVector1);
            p2.getWorldPosition(this.pVector2);
            p1.parent.getWorldQuaternion(this.pQuat1);
            p2.parent.getWorldQuaternion(this.pQuat2);
            p1.quaternion.setFromUnitVectors(this.pUp,this.pVector1.sub(this.pVector2).normalize()).premultiply(this.pQuat1.inverse());
            p2.quaternion.setFromUnitVectors(this.pUp,this.pVector1.negate()).premultiply(this.pQuat2.inverse());
        }
    }
    solveFeet(dt){
        this.leftFootTarget.position.set(2.4+Math.abs(this.lastSep)*0.5,0,0);
        this.rightFootTarget.position.set(-2.4-Math.abs(this.lastSep)*0.5,0,0);
        this.leftFootTarget.quaternion.identity();
        this.rightFootTarget.quaternion.identity();
        this.leftFootTarget.applyMatrix4(this.transform.matrix);
        this.rightFootTarget.applyMatrix4(this.transform.matrix);

        var rd = new Vector3(0,-1,0);

        var rro = this.rightFootTarget.position.clone();
        rro.y=this.leftFoot.current.position.y==0?100:this.leftFoot.current.position.y+4;

        var lro = this.leftFootTarget.position.clone();
        lro.y=this.rightFoot.current.position.y==0?100:this.rightFoot.current.position.y+4;

        //rro.y=Math.min(rro.y,lro.y);
        //rro.y=lro.y;

        var ray = new Ray(rro,rd)
        var rightRay=this.worldmap.octree.rayIntersect(ray);
        if(rightRay){
            var rnormal = rightRay.tri.getNormal(new Vector3);
            if(rnormal.y>0.707){
                this.rightFootTarget.position.copy(rightRay.position);
                this.rightFootTarget.position.add(rnormal.multiplyScalar(0.60));
                this.rightFootTarget.quaternion.premultiply(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),rnormal));
            }
        }



        var ray = new Ray(lro,rd)
        var leftRay=this.worldmap.octree.rayIntersect(ray);
        if(leftRay){
            var lnormal = leftRay.tri.getNormal(new Vector3);
            if(lnormal.y>0.707){
                this.leftFootTarget.position.copy(leftRay.position);
                this.leftFootTarget.position.add(lnormal.multiplyScalar(0.60));
                this.leftFootTarget.quaternion.premultiply(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),lnormal));
            }
        }





        this.leftFootTarget.updateMatrixWorld();
        this.rightFootTarget.updateMatrixWorld();
        
        var speed = Math.abs(this.velocity.z)*0.005+Math.abs(this.velocity.x)*0.01+0.7
        var height =0;
        if(this.leftFoot.footFallSpeed!=0 || this.rightFoot.footFallSpeed!=0){
            speed= 0.75;
        }

        this.leftFoot.setSpeed(speed);
        this.rightFoot.setSpeed(speed);


        this.leftFoot.update(dt,height);
        this.rightFoot.update(dt,height);

        //adjust foot seaparation to account for height
        var dh = this.leftFoot.current.position.y - this.rightFoot.current.position.y;
        this.lastSep=dh*0.25;       

        if(Math.abs(dh)>1.5){
            if(dh<0){
                this.leftFoot.current.position.y=this.rightFoot.current.position.y-1.5;
                this.velocity.x=1*dt;
            }else if(dh>0){
                this.rightFoot.current.position.y=this.leftFoot.current.position.y-1.5;
                this.velocity.x=-1*dt;
            }
        }

        var leftPad = this.bones['padL'];
        var quaternion = leftPad.quaternion;
        leftPad.parent.updateMatrixWorld();
        leftPad.parent.getWorldQuaternion(quaternion).inverse();
        quaternion.multiply(this.leftFoot.current.quaternion);

        var rightPad = this.bones['padR'];
        var quaternion = rightPad.quaternion;
        rightPad.parent.updateMatrixWorld();
        rightPad.parent.getWorldQuaternion(quaternion).inverse();
        quaternion.multiply(this.rightFoot.current.quaternion);

    }
    solveBones(bones,target,tailPos){
        bones.forEach(bone=>bone.updateMatrixWorld());
    
        var limits = this.limits;
        var stiffness = this.stiffness;
        var IKBone = bones[bones.length-1];
        var IKPos = IKBone.localToWorld(tailPos.clone());
        var quaternion = new Quaternion();
        var t = target.clone();
        for(var i=0;i<bones.length;i++){
            var bone=bones[i];
            var curretPos = bone.parent.worldToLocal(IKPos.clone()).sub(bone.position);
            var targetPos = bone.parent.worldToLocal(target.clone()).sub(bone.position);
    
            curretPos.normalize();
            targetPos.normalize();
    
    
            quaternion.setFromUnitVectors( curretPos, targetPos.multiplyScalar(1-stiffness[bone.name]).add(curretPos).normalize());
            bone.applyQuaternion(quaternion);
            
            bone.rotation.x -= bone.initalRotation.x;
            bone.rotation.y -= bone.initalRotation.y;
            bone.rotation.z -= bone.initalRotation.z;
            bone.rotation.x=Math.min(limits[bone.name].max.x,Math.max(limits[bone.name].min.x,bone.rotation.x));
            bone.rotation.y=Math.min(limits[bone.name].max.y,Math.max(limits[bone.name].min.y,bone.rotation.y));
            bone.rotation.z=Math.min(limits[bone.name].max.z,Math.max(limits[bone.name].min.z,bone.rotation.z));
            bone.rotation.x += bone.initalRotation.x;
            bone.rotation.y += bone.initalRotation.y;
            bone.rotation.z += bone.initalRotation.z;
        }
    }
    solveBody(dt){
        //body position
        var target = this.leftFoot.current.position.clone().add(this.rightFoot.current.position).multiplyScalar(0.5);
        target.y+=1.4+Math.min(0.3,Math.abs(this.velocity.z)*0.05)+this.jumpHeight; // offset above ground
        target.x-=this.transform.matrix.elements[2]*0.5; // offset in directino of walk
        target.z+=this.transform.matrix.elements[10]*0.5; // offset in directino of walk



        this.bodyPosition.update(target,this.bodyPositionCurrent,dt);


        this.bones['body'].position.copy(this.bodyPositionCurrent);

        //body direction
        var dir = this.leftFoot.current.position.clone().sub(this.rightFoot.current.position);
        if(this.leftFoot.footFallSpeed!=0 || this.rightFoot.footFallSpeed!=0){
            dir.x*=0.5;
            dir.z*=0.5;
        }
        var bodyTarget = this.bones['body'].position.clone();
        var walkLean = 20;
        bodyTarget.x-=(dir.z*1.0-this.transform.matrix.elements[2])*walkLean; //3 
        bodyTarget.z+=(dir.x*1.0+this.transform.matrix.elements[10])*walkLean; //11

        bodyTarget.add(this.camera.mouseTarget.clone().sub(this.bones['body'].position).multiplyScalar(0.05));


        this.bodyLookRotation.update(bodyTarget,this.bodyLookRotationCurrent,dt);

        //body up
        var topTarget = this.bones['body'].position.clone();
        topTarget.y +=20;
        var jump = this.jumpHeight==0?1:-1;
        topTarget.x -= this.transform.matrix.elements[2]*this.velocity.z*0.5*jump;
        topTarget.z += this.transform.matrix.elements[10]*this.velocity.z*0.5*jump;

        
        topTarget.x -= this.transform.matrix.elements[0]*dir.y*0.5;
        topTarget.z += this.transform.matrix.elements[8]*dir.y*0.5;
        
        this.bodyUpRotation.update(topTarget,this.bodyUpRotationCurrent,dt);

    }
    getBodyHeight(){
        var rd = new Vector3(0,-1,0);
        var ro = this.leftFootTarget.position.clone();
        ro.y=this.bones['body'].position.y==0?100:this.bones['body'].position.y+4;
        var ray = new Ray(ro,rd)
        var bodyRay=this.worldmap.octree.rayIntersect(ray);
        return bodyRay?bodyRay.position.y:0;
    }
    solveHead(dt){
        //head up
        var topTarget = this.bones['body'].position.clone();
        topTarget.y +=20;
        topTarget.x -= this.transform.matrix.elements[2]*this.velocity.z*0.35;
        topTarget.z += this.transform.matrix.elements[10]*this.velocity.z*0.35;
        
        this.headUpRotation.update(topTarget,this.headUpRotationCurrent,dt);

        //head direction
        var dir = this.leftFoot.current.position.clone().sub(this.rightFoot.current.position);
        
        var lookTarget = this.bones['body'].position.clone();
        lookTarget.x-=dir.z*1.5+this.transform.matrix.elements[2]*10; //3 
        lookTarget.z+=dir.x*1.5+this.transform.matrix.elements[10]*10; //11

        lookTarget.add(this.camera.mouseTarget.clone().sub(this.bones['body'].position).multiplyScalar(0.07));

        this.headLookRotation.update(lookTarget,this.headLookRotationCurrent,dt);
    }
    jumping(dt){
        if(this.jumped){
            var delta = Math.min(1,(performance.now()-this.jumped)/200);
            this.jumpHeight=delta*1.5; 

            if(delta==1){
                this.jumped=false;
                this.leftFoot.footFallSpeed=0.04; 
                this.rightFoot.footFallSpeed=0.04;
            }
        }else if(this.leftFoot.footFallSpeed==0){
            this.jumpHeight = 0;
        }
        if(this.jumpHeight>0) this.jumpHeight=this.jumpHeight*0.95;
    }
    jump(){
        if(this.leftFoot.footFallSpeed==0 && !this.jumped){
            this.jumped=performance.now();
            this.velocity.x=0;
        }
    }
    fire(left){
        this.firelight.intensity=1;
        this.firelight.position.x=left?-1.5:1.5;
        this.firelight.position.z=2;
        var dir = left?2:-2;
        this.headLookRotationCurrent.x-=this.transform.matrix.elements[0]*dir*0.5; //3 
        this.headLookRotationCurrent.z+=this.transform.matrix.elements[8]*dir*0.5; //11
        this.bodyLookRotationCurrent.x-=this.transform.matrix.elements[0]*dir*3; //3 
        this.bodyLookRotationCurrent.z+=this.transform.matrix.elements[8]*dir*3; //11
        setTimeout(()=>{
            this.firelight.intensity=0;
        },100)
    }
    reset(){
        this.leftFoot.current.position.set(-149.33703236930089, 60.93269854502356, 1.0489723445463879);
        this.rightFoot.current.position.set(-145.514705751424, 60.93424401147795, 1.8299734372777685);
        this.bodyPositionCurrent.set(-147.6667428120401, 62.33690706208446, 3.302914070560551);
        this.bodyUpRotationCurrent.set(-147.23286912360183, 82.34730513083026, 2.827078299886173);
        this.bodyLookRotationCurrent.set(-17.972751413963238, 58.54601822008478, 39.62467615843437);
        this.headLookRotationCurrent.set(-121.51441304215152, 55.37388833822193, 13.503389485918092);
        this.headUpRotationCurrent.set(-147.2464924307116, 82.33299250172223, 2.9940798973077274);
        this.transform.position.set(-147.70591945882194, 0.5126919606437506, 2.809559988408076);
        //this.transform.quaternion.set(0, 0.7456869494428513, 0, -0.6662964606169048);
        this.transform.updateMatrix();
        this.transform.updateMatrixWorld( true );
        this.transform.updateWorldMatrix( true, true );
        this.leftFoot.start.copy(this.leftFoot.current);
        this.leftFoot.end.copy(this.leftFoot.current);
        this.rightFoot.start.copy(this.rightFoot.current);
        this.rightFoot.end.copy(this.rightFoot.current);
        this.leftFootTarget.position.copy(this.leftFoot.current.position);
        this.rightFootTarget.position.copy(this.rightFoot.current.position);
        this.velocity.set(0,0,0);
        this.jumpVelocity = 0;
        this.jumpHeight = 0;
        this.lastSep = 0;
        this.leftFoot.footFallSpeed = 0;
        this.rightFoot.footFallSpeed = 0;
        this.bones['body'].position.copy(this.bodyPositionCurrent);
    }
    update(dt){
        //slow veclotity over time
        var damping = 0.003;
        if((this.leftFoot.footFallSpeed==0 || this.rightFoot.footFallSpeed==0) && this.jumpHeight==0){
            this.velocity.multiplyScalar(1-dt*damping);
        }
        if(this.state!==READY) return;
        this.colideSphere.center.copy(this.bones['body'].position);
        this.colideSphere.center.y+=2.0;

        this.solveBody(dt);
        this.solveHead(dt);
        for(var i=0;i<10;i++){
            this.solveBones(this.ikGroups['dirBones'],this.bodyLookRotationCurrent,new Vector3(0,0,1));
            this.solveBones(this.ikGroups['dirBones'],this.bodyUpRotationCurrent,new Vector3(0,1,0));
            this.solveBones(this.ikGroups['headBones'],this.headUpRotationCurrent,new Vector3(0,1,0));
            this.solveBones(this.ikGroups['headBones'],this.headLookRotationCurrent,new Vector3(0,0,1));
        }
        
        this.jumping(dt);
        this.solveFeet(dt);

        for(var i=0;i<50;i++){
            this.solveBones(this.ikGroups['leftLegBones'],this.leftFoot.current.position,this.footPosition);
            this.solveBones(this.ikGroups['rightLegBones'],this.rightFoot.current.position,this.footPosition);
            
        }
        for(var i=0;i<10;i++){
            this.solveBones(this.ikGroups['rightArmBones'],this.camera.mouseTarget,new Vector3(0,50,0));
            this.solveBones(this.ikGroups['leftArmBones'],this.camera.mouseTarget,new Vector3(0,50,0));
        }

        this.solvePiston();

        var res = this.worldmap.octree.sphereIntersect(this.colideSphere);
        
        if(res.length>0){
            var md = 1e6, result;
            for(var i = 0;i<res.length;i++){
                
                if(Math.abs(res[i].depth)<md){
                    md=Math.abs(res[i].depth);
                    result = res[i];
                }
            }
            this.transform.position.add(result.normal.clone().multiplyScalar(result.depth*0.5));
            result.normal.y=0;
            result.normal.normalize();
            result.normal.applyQuaternion(this.transform.quaternion.clone().inverse());
            var v=this.velocity.dot(result.normal);
            if(v<0) this.velocity.add(result.normal.multiplyScalar(-v));
        }

        this.transform.translateZ(this.velocity.z*dt/1000);
        this.transform.translateX(this.velocity.x*dt/1000);
        this.transform.updateMatrixWorld();
    }
}