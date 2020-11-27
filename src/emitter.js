
import { 
    MeshBasicMaterial,
    Mesh,
    TextureLoader,
    RepeatWrapping,
    AdditiveBlending,
    SphereBufferGeometry,
    DoubleSide,
    PointsMaterial,
    Points,
    BufferGeometry,
    Float32BufferAttribute
} from './three.js'

import noise from '../res/textures/noise.png';
import sparkle from '../res/textures/sparkle.png';

const texture = new TextureLoader().load( noise );
texture.wrapS = RepeatWrapping;
texture.wrapT = RepeatWrapping;
const texturePoint = new TextureLoader().load( sparkle );

var geometry = new SphereBufferGeometry( 6, 32, 32 );

export default class Emitter{
    constructor(position,scene){
        this.material = new MeshBasicMaterial( {color: 0x111111, blending: AdditiveBlending, map:texture, depthTest: true, depthWrite: false, opacity: 0.3, transparent: true,side: DoubleSide} );
        var materialShader;
        this.material.onBeforeCompile=(shader)=>{
            shader.fragmentShader = shader.fragmentShader.replace("#include <common>",`
            #include <common>
            uniform float uTime;
            `)
            shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`
                float texelColor1 = texture2D( map, vUv*10.0+vec2(0.0,uTime)*0.5 ).r;
                float texelColor2 = texture2D( map, vUv*7.0-vec2(uTime,0.0)*0.2 ).r;
                float texelColor = (texelColor1-0.5)+(texelColor2-0.5);
                float td1 = 1.0-clamp(abs(texelColor)*50.0,0.0,1.0);
                float td2 = 1.0-clamp(abs(texelColor)*20.0,0.0,1.0);
                diffuseColor.rgb *= vec3(td1)+td2*vec3(0.03,0.5,1.0)+vec3(0.03,0.1,0.2);
            `)
            shader.vertexShader = shader.vertexShader.replace("#include <common>",`
            #include <common>
            uniform float uTime;
            `)
            shader.vertexShader=shader.vertexShader.replace("#include <project_vertex>",`
            transformed.x+=sin(uTime*5.0+transformed.y*100.0);
            transformed.z+=sin(uTime*5.0+transformed.y*100.0);
            transformed.y+=sin(uTime*5.0+transformed.x+transformed.z);
            #include <project_vertex>
            `)
            shader.uniforms['uTime']={value:0};
            materialShader = shader;
        }

        this.positions = [];
        this.count=1000;
        for(var i = 0; i<this.count; i++){
            var dx = Math.random()-0.5;
            var dy = Math.random()-0.5;
            var dz = Math.random()-0.5;
            var d = Math.sqrt(dx*dx+dy*dy+dz*dz);
            var l = Math.random()+1.0;
            this.positions.push(dx/d*15.0*l,dy/d*2.0*l,dz/d*15.0*l);
        }
        this.geometry = new BufferGeometry();
        this.geometry.setAttribute( 'position', new Float32BufferAttribute( this.positions, 3 ) );

        this.material2 = new PointsMaterial( { size: 4, map:texturePoint,blending: AdditiveBlending,  depthTest: true, depthWrite: false, opacity: 0.1, transparent: false,color: 0xffffff } )
        var matShader;
        this.material2.onBeforeCompile=shader=>{            
            shader.vertexShader = shader.vertexShader.replace("#include <common>",`
                uniform float uTime;
                #include <common>
            `);
            shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",`
                vec3 transformed = vec3( position );
                float l = length(position);
                float angle = l*uTime*0.2;
                float ca = cos(angle);
                float sa = sin(angle);
                vec2 trans = vec2(position.x,position.z);
                transformed.x = trans.x*ca+trans.y*sa;
                transformed.z = trans.y*ca-trans.x*sa;
                transformed.y +=sin(l*5.0+uTime)/l*10.0;
            `);
            shader.uniforms["uTime"]={value: 0};
            matShader=shader;
        };
        var particles = new Points( this.geometry, this.material2 );
        
        particles.frustumCulled =false;

        var sphere = new Mesh( geometry, this.material );
        sphere.frustumCulled =false;
        sphere.onBeforeRender=()=>{
            if(materialShader) materialShader.uniforms['uTime'].value=performance.now()/1000;
            if(matShader) matShader.uniforms['uTime'].value=performance.now()/1000;
        }
        sphere.position.copy(position);
        particles.position.copy(position);
        scene.add( sphere );
        scene.add( particles );
    }
    setStrengh(strengh){
        this.material.color.setRGB(1+strengh*2,strengh,strengh);
        this.material2.color.setRGB(1+strengh*2,strengh,strengh);
        this.material.opacity=strengh*0.5+0.1;
        this.material2.opacity=strengh*0.1;
    }
}