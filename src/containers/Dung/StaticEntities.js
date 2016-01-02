import React, { Component } from 'react';
import THREE from 'three';
import Shrink from './Shrink';
import Wall from './Wall';
import TubeBend from './TubeBend';
import TubeStraight from './TubeStraight';

export default class StaticEntities extends Component {

    constructor(props, context) {
        super(props, context);
    }

    render() {

        const { entities, time } = this.props;

        return <group>
            <resources>
                <boxGeometry
                    resourceId="1x1box"

                    width={1}
                    height={1}
                    depth={1}

                    widthSegments={1}
                    heightSegments={1}
                />
                <boxGeometry
                    resourceId="wallGeometry"
                    width={1}
                    height={1}
                    depth={1}
                    widthSegments={1}
                    heightSegments={1}
                />
                <meshPhongMaterial
                    resourceId="ornateWall"
                    color={ 0xffffff }
                >
                    <texture
                        url={ require( './brick-pattern-ornate.png' ) }
                        wrapS={ THREE.RepeatWrapping }
                        wrapT={ THREE.RepeatWrapping }
                        anisotropy={16}
                    />
                </meshPhongMaterial>

                <meshPhongMaterial
                    resourceId="tubeMaterial"
                    color={0xffffff}
                    side={ THREE.DoubleSide }
                    transparent
                >
                    <texture
                        url={ require( '../Game/tube-pattern-1.png' ) }
                        wrapS={ THREE.RepeatWrapping }
                        wrapT={ THREE.RepeatWrapping }
                        anisotropy={16}
                    />
                </meshPhongMaterial>

            </resources>

            { this.props.entities.map( ( entity ) => {

                if( entity.type === 'wall' ) {

                    return <Wall
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        materialId="ornateWall"
                    />;

                } else if( entity.type === 'tube' ) {

                    return <TubeStraight
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        materialId="tubeMaterial"
                    />;

                } else if( entity.type === 'tubebend' ) {

                    return <TubeBend
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        materialId="tubeMaterial"
                    />;

                } else if( entity.type === 'shrink' ) {

                    return <Shrink
                        time={ time }
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        wrapMaterialId="shrinkWrapMaterial"
                        materialId="shrinkMaterial"
                    />;

                }

            }) }

        </group>;
    }

}
