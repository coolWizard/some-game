import React, { Component, PropTypes } from 'react';
import THREE from 'three';
import Textures from '../helpers/Textures';

export default [
    ...Object.keys( Textures ).map( key =>
        <meshPhongMaterial
            key={ key }
            resourceId={ key }
            color={ 0xffffff }
        >
            <texture
                url={ Textures[ key ] }
                wrapS={ THREE.RepeatWrapping }
                wrapT={ THREE.RepeatWrapping }
                anisotropy={ 16 }
            />
        </meshPhongMaterial>
    ),
    <boxGeometry
        resourceId="1x1box"
        width={ 1 }
        height={ 1 }
        depth={ 1 }
        widthSegments={ 1 }
        heightSegments={ 1 }
    />,
    <meshBasicMaterial
        resourceId="transparent"
        visible={ false }
    />,
    <meshPhongMaterial
        resourceId="finishFlag"
        side={ THREE.DoubleSide }
        transparent
        opacity={ 0.7 }
    />,
    <meshPhongMaterial
        resourceId="placeholder2"
        side={ THREE.DoubleSide }
        transparent
        opacity={ 0.8 }
        color={ 0x00ff00 }
    />,
    <meshPhongMaterial
        resourceId="placeholder"
        side={ THREE.DoubleSide }
        transparent
        opacity={ 0.8 }
        color={ 0xff0000 }
    />,
    <planeBufferGeometry
        resourceId="1x1plane"
        width={ 1 }
        height={ 1 }
        widthSegments={ 1 }
        heightSegments={ 1 }
    />,
    <sphereGeometry
        resourceId="radius1sphere"
        radius={ 0.5 }
        widthSegments={ 6 }
        heightSegments={ 6 }
    />
];