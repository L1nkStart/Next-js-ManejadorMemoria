"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Square, ArrowRight, Move, FlipHorizontal as SwapHorizontal, ArrowLeftRight, HardDrive } from "lucide-react";

interface MemoryBlock {
  id: number;
  size: number;
  type: "process" | "free";
  name: string;
  actualSize?: number;
  isMoving?: boolean;
}

let uniqueId = 1;
const getUniqueId = () => uniqueId++;

export default function Home() {
  const [memoryBlocks, setMemoryBlocks] = useState<MemoryBlock[]>([
    { id: getUniqueId(), size: 100, type: "free", name: "Free" },
  ]);
  const [swappedProcesses, setSwappedProcesses] = useState<MemoryBlock[]>([]);
  const [totalMemory] = useState(100);
  const [nextProcessId, setNextProcessId] = useState(1);
  const [processSize, setProcessSize] = useState(10);

  const calculateMetrics = () => {
    const used = memoryBlocks.reduce((acc, block) =>
      block.type === "process" ? acc + block.size : acc, 0);
    const free = totalMemory - used;

    const externalFragmentation = memoryBlocks.reduce((acc, block) =>
      block.type === "free" && block.size < processSize ? acc + block.size : acc, 0);

    const internalFragmentation = memoryBlocks.reduce((acc, block) =>
      block.type === "process" && block.actualSize
        ? acc + (block.size - block.actualSize)
        : acc, 0);

    return { used, free, externalFragmentation, internalFragmentation };
  };

  const addProcess = () => {
    if (processSize <= 0 || processSize > totalMemory) {
      return;
    }

    const actualSize = Math.max(processSize - Math.floor(Math.random() * 5), 1);

    const newProcess = {
      id: getUniqueId(),
      size: processSize,
      actualSize,
      type: "process" as const,
      name: `P${nextProcessId}`
    };

    setMemoryBlocks(prev => {
      // Find first fit
      for (let i = 0; i < prev.length; i++) {
        const block = prev[i];
        if (block.type === "free" && block.size >= processSize) {
          const newBlocks = [...prev];

          // Randomly create fragmentation (30% chance)
          const shouldFragment = Math.random() < 0.3;

          if (shouldFragment && block.size > processSize + 10) {
            // Create a random small fragment before the process
            const fragmentSize = Math.floor(Math.random() * 5) + 1;
            const remainingSize = block.size - processSize - fragmentSize;

            // Add fragment, process, and remaining space
            newBlocks[i] = { id: getUniqueId(), size: fragmentSize, type: "free", name: "Free" };
            newBlocks.splice(i + 1, 0, newProcess);

            if (remainingSize > 0) {
              newBlocks.splice(i + 2, 0, {
                id: getUniqueId(),
                size: remainingSize,
                type: "free",
                name: "Free"
              });
            }
          } else {
            // Normal allocation without fragmentation
            const remainingSize = block.size - processSize;
            newBlocks[i] = newProcess;

            if (remainingSize > 0) {
              newBlocks.splice(i + 1, 0, {
                id: getUniqueId(),
                size: remainingSize,
                type: "free",
                name: "Free"
              });
            }
          }

          setNextProcessId(prev => prev + 0.5);
          return newBlocks;
        }
      }
      return prev;
    });
  };

  const compactMemory = () => {
    setMemoryBlocks(prev => {
      const processes = prev.filter(block => block.type === "process");
      const totalUsedSize = processes.reduce((acc, proc) => acc + proc.size, 0);
      const totalFreeSize = totalMemory - totalUsedSize;

      if (totalFreeSize > 0) {
        return [
          ...processes,
          { id: getUniqueId(), size: totalFreeSize, type: "free", name: "Free" }
        ];
      }
      return processes;
    });
  };

  const swapOutRandomProcess = () => {
    let processToSwap: MemoryBlock | null = null;

    setMemoryBlocks(prev => {
      const processes = prev.filter(block => block.type === "process");
      if (processes.length === 0) return prev;

      const randomIndex = Math.floor(Math.random() * processes.length);
      processToSwap = processes[processes.length - 1]; // Guardamos el proceso seleccionado

      return prev.map(block =>
        block.id === processToSwap!.id
          ? { ...block, type: "free", name: "Free" } // Solo cambia el tipo y nombre
          : block
      );
    });

    if (processToSwap) {
      setSwappedProcesses(prevSwapped => {
        const exists = prevSwapped.some(p => p.id === processToSwap!.id);
        if (exists) return prevSwapped;
        return [...prevSwapped, { ...processToSwap!, id: getUniqueId() }];
      });
    }
  };




  const restoreSwappedProcess = (swappedProcess: MemoryBlock) => {
    // Find a suitable free block
    const freeBlock = memoryBlocks.find(block =>
      block.type === "free" && block.size >= swappedProcess.size
    );

    if (freeBlock) {
      setMemoryBlocks(prev => {
        const index = prev.findIndex(block => block.id === freeBlock.id);
        const newBlocks = [...prev];

        // Place the process
        const remainingSize = freeBlock.size - swappedProcess.size;
        newBlocks[index] = { ...swappedProcess, id: getUniqueId() };

        if (remainingSize > 0) {
          newBlocks.splice(index + 1, 0, {
            id: getUniqueId(),
            size: remainingSize,
            type: "free",
            name: "Free"
          });
        }

        return newBlocks;
      });

      // Remove from swapped processes
      setSwappedProcesses(prev =>
        prev.filter(proc => proc.id !== swappedProcess.id)
      );
    }
  };

  const relocateRandomProcess = () => {
    setMemoryBlocks(prev => {
      const processes = prev.filter(block => block.type === "process");
      const freeBlocks = prev.filter(block => block.type === "free");

      if (processes.length === 0 || freeBlocks.length === 0) return prev;

      // Seleccionamos un proceso aleatorio
      const randomProcessIndex = Math.floor(Math.random() * processes.length);
      const processToMove = processes[randomProcessIndex];

      // Encontramos bloques libres que puedan acomodarlo
      const suitableFreeBlocks = freeBlocks.filter(block => block.size >= processToMove.size);
      if (suitableFreeBlocks.length === 0) return prev;

      // Seleccionamos un bloque libre aleatorio
      const randomFreeBlock = suitableFreeBlocks[Math.floor(Math.random() * suitableFreeBlocks.length)];

      return prev.flatMap(block => {
        if (block.id === processToMove.id) {
          // Convertimos el bloque de proceso a espacio libre
          return { ...block, type: "free", name: "Free" };
        }
        if (block.id === randomFreeBlock.id) {
          // Movemos el proceso al nuevo bloque
          const remainingSize = block.size - processToMove.size;
          const newBlocks: MemoryBlock[] = [
            { ...processToMove, id: getUniqueId() }, // Nuevo bloque de proceso
          ];
          if (remainingSize > 0) {
            newBlocks.push({
              id: getUniqueId(),
              size: remainingSize,
              type: "free",
              name: "Free",
            });
          }
          return newBlocks;
        }
        return block;
      });
    });
  };


  const metrics = calculateMetrics();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Simulador de Gestión de Memoria</h1>
          <p className="text-muted-foreground">
            Visualización interactiva de técnicas de gestión de memoria y fragmentación
          </p>
        </div>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Técnicas de Gestión</h2>
          <div className="flex gap-4 flex-wrap">
            <Button onClick={compactMemory} className="flex gap-2">
              <Move className="h-4 w-4" />
              Compactar
            </Button>
            <Button onClick={swapOutRandomProcess} className="flex gap-2">
              <SwapHorizontal className="h-4 w-4" />
              Simular Swapping
            </Button>
            <Button onClick={relocateRandomProcess} className="flex gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Reubicar Proceso
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 col-span-2">
            <h2 className="text-xl font-semibold mb-4">Memoria Principal</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                {memoryBlocks.map((block, index) => (
                  <div
                    key={block.id}
                    className={`flex-grow h-40 rounded-lg flex items-center justify-center flex-col relative ${block.type === "process"
                      ? "bg-primary/20 border-primary/50"
                      : "bg-secondary border-secondary/50"
                      } border-2 transition-all duration-300`}
                    style={{
                      flexBasis: `${(block.size / totalMemory) * 100}%`,
                    }}
                  >
                    <span className="font-mono">{block.name}</span>
                    <span className="text-sm text-muted-foreground">{block.size}MB</span>
                    {block.type === "process" && block.actualSize && (
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-destructive/20 border-t border-destructive/50"
                        style={{ height: `${((block.size - block.actualSize) / block.size) * 100}%` }}
                      >
                        <span className="text-xs text-destructive absolute bottom-0 left-1/2 transform -translate-x-1/2">
                          Frag. Interna
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-4 items-center">
                <div className="flex-grow">
                  <p className="text-sm text-muted-foreground mb-2">Tamaño del proceso ({processSize}MB)</p>
                  <Slider
                    value={[processSize]}
                    onValueChange={([value]) => setProcessSize(value)}
                    max={50}
                    min={5}
                    step={5}
                  />
                </div>
                <Button
                  onClick={addProcess}
                  disabled={!memoryBlocks.some(block => block.type === "free" && block.size >= processSize)}
                >
                  Agregar Proceso
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Métricas</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Memoria Utilizada</p>
                <p className="text-2xl font-mono">{metrics.used}MB</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Memoria Libre</p>
                <p className="text-2xl font-mono">{metrics.free}MB</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fragmentación Externa</p>
                <p className="text-2xl font-mono">{metrics.externalFragmentation}MB</p>
                <p className="text-xs text-muted-foreground">Bloques libres demasiado pequeños para el siguiente proceso</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fragmentación Interna</p>
                <p className="text-2xl font-mono">{metrics.internalFragmentation}MB</p>
                <p className="text-xs text-muted-foreground">Espacio no utilizado dentro de los bloques asignados</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 col-span-2">
            <h2 className="text-xl font-semibold mb-4">Memoria de Intercambio</h2>
            <div className="flex gap-2 min-h-[100px] bg-muted/20 rounded-lg p-4">
              {swappedProcesses.length === 0 ? (
                <div className="flex items-center justify-center w-full text-muted-foreground">
                  <HardDrive className="h-6 w-6 mr-2" />
                  No hay procesos en memoria de intercambio
                </div>
              ) : (
                swappedProcesses.map(process => (
                  <div
                    key={process.id}
                    className="bg-primary/20 border-2 border-primary/50 rounded-lg p-4 cursor-pointer hover:bg-primary/30 transition-colors"
                    onDoubleClick={() => restoreSwappedProcess(process)}
                  >
                    <div className="text-center">
                      <p className="font-mono">{process.name}</p>
                      <p className="text-sm text-muted-foreground">{process.size}MB</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Doble click sobre un proceso para restaurarlo a la memoria principal
            </p>
          </Card>
        </div>


      </div>
    </div>
  );
}