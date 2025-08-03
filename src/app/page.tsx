"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, Download } from "lucide-react";
import dynamic from "next/dynamic";
import * as math from "mathjs";
import { CheckedState } from "@radix-ui/react-checkbox";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface DifferentiationMethod {
  name: string;
  formula: string;
  order: string;
  color: string;
  calculate: (
    f: (x: number) => number,
    x: number,
    h: number,
    points?: number[]
  ) => number;
}

const methods: DifferentiationMethod[] = [
  {
    name: "Forward Difference",
    formula: "(f(x+h) - f(x)) / h",
    order: "O(h)",
    color: "#3b82f6",
    calculate: (f, x, h) => (f(x + h) - f(x)) / h,
  },
  {
    name: "Backward Difference",
    formula: "(f(x) - f(x-h)) / h",
    order: "O(h)",
    color: "#ef4444",
    calculate: (f, x, h) => (f(x) - f(x - h)) / h,
  },
  {
    name: "Central Difference",
    formula: "(f(x+h) - f(x-h)) / (2h)",
    order: "O(h²)",
    color: "#10b981",
    calculate: (f, x, h) => (f(x + h) - f(x - h)) / (2 * h),
  },
];

export default function NumericalDifferentiationCalculator() {
  const [functionInput, setFunctionInput] = useState("x^2 + 2*x + 1");
  const [evaluationPoint, setEvaluationPoint] = useState(1);
  const [stepSize, setStepSize] = useState(0.1);
  const [selectedMethods, setSelectedMethods] = useState<string[]>([
    "Central Difference",
  ]);
  const [showError, setShowError] = useState<CheckedState>(true);
  const [showTangentLines, setShowTangentLines] = useState<CheckedState>(true);
  const [results, setResults] = useState<any[]>([]);
  const [plotData, setPlotData] = useState<any[]>([]);
  const [errorData, setErrorData] = useState<any[]>([]);
  const [functionError, setFunctionError] = useState("");

  // Parse and evaluate function
  const parseFunction = useCallback((input: string) => {
    try {
      const expr = math.parse(input);
      const compiled = expr.compile();
      return (x: number) => {
        try {
          return compiled.evaluate({ x });
        } catch {
          return Number.NaN;
        }
      };
    } catch (error) {
      setFunctionError("Invalid function syntax");
      return null;
    }
  }, []);

  // Calculate analytical derivative for comparison
  const getAnalyticalDerivative = useCallback((input: string) => {
    try {
      const expr = math.parse(input);
      const derivative = math.derivative(expr, "x");
      const compiled = derivative.compile();
      return (x: number) => {
        try {
          return compiled.evaluate({ x });
        } catch {
          return Number.NaN;
        }
      };
    } catch {
      return null;
    }
  }, []);

  // Calculate numerical derivatives
  const calculateDerivatives = useCallback(() => {
    const func = parseFunction(functionInput);
    const analyticalDerivative = getAnalyticalDerivative(functionInput);

    if (!func) return;

    setFunctionError("");
    const h = stepSize;
    const x = evaluationPoint;
    const newResults: any[] = [];

    selectedMethods.forEach((methodName) => {
      const method = methods.find((m) => m.name === methodName);
      if (!method) return;

      const numericalResult = method.calculate(func, x, h);
      const analyticalResult = analyticalDerivative
        ? analyticalDerivative(x)
        : null;
      const error =
        analyticalResult !== null
          ? Math.abs(numericalResult - analyticalResult)
          : null;
      const relativeError =
        analyticalResult !== null && analyticalResult !== 0
          ? Math.abs((numericalResult - analyticalResult) / analyticalResult) *
            100
          : null;

      newResults.push({
        method: methodName,
        numerical: numericalResult,
        analytical: analyticalResult,
        absoluteError: error,
        relativeError: relativeError,
        formula: method.formula,
        order: method.order,
        color: method.color,
      });
    });

    setResults(newResults);
  }, [
    functionInput,
    evaluationPoint,
    stepSize,
    selectedMethods,
    parseFunction,
    getAnalyticalDerivative,
  ]);

  // Generate plot data
  const generatePlotData = useCallback(() => {
    const func = parseFunction(functionInput);
    if (!func) return;

    const xRange = Array.from(
      { length: 200 },
      (_, i) => (i - 100) * 0.1 + evaluationPoint
    );
    const yRange = xRange.map((x) => func(x));

    const traces: any[] = [
      {
        x: xRange,
        y: yRange,
        type: "scatter",
        mode: "lines",
        name: `f(x) = ${functionInput}`,
        line: { color: "#1f2937", width: 3 },
      },
    ];

    // Add evaluation point
    traces.push({
      x: [evaluationPoint],
      y: [func(evaluationPoint)],
      type: "scatter",
      mode: "markers",
      name: "Evaluation Point",
      marker: { color: "#dc2626", size: 10 },
    });

    // Add tangent lines for each method
    if (showTangentLines) {
      results.forEach((result) => {
        const slope = result.numerical;
        const y0 = func(evaluationPoint);
        const tangentX = [evaluationPoint - 1, evaluationPoint + 1];
        const tangentY = tangentX.map(
          (x) => y0 + slope * (x - evaluationPoint)
        );

        traces.push({
          x: tangentX,
          y: tangentY,
          type: "scatter",
          mode: "lines",
          name: `${result.method} Tangent`,
          line: { color: result.color, width: 2, dash: "dash" },
        });
      });
    }

    // Add sampling points
    const h = stepSize;
    selectedMethods.forEach((methodName) => {
      const method = methods.find((m) => m.name === methodName);
      if (!method) return;

      let samplingPoints: number[] = [];
      if (methodName === "Forward Difference") {
        samplingPoints = [evaluationPoint, evaluationPoint + h];
      } else if (methodName === "Backward Difference") {
        samplingPoints = [evaluationPoint - h, evaluationPoint];
      } else if (methodName === "Central Difference") {
        samplingPoints = [evaluationPoint - h, evaluationPoint + h];
      }

      traces.push({
        x: samplingPoints,
        y: samplingPoints.map((x) => func(x)),
        type: "scatter",
        mode: "markers",
        name: `${methodName} Points`,
        marker: { color: method.color, size: 8, symbol: "square" },
      });
    });

    setPlotData(traces);
  }, [
    functionInput,
    evaluationPoint,
    stepSize,
    selectedMethods,
    results,
    showTangentLines,
    parseFunction,
  ]);

  // Generate error analysis data
  const generateErrorData = useCallback(() => {
    const func = parseFunction(functionInput);
    const analyticalDerivative = getAnalyticalDerivative(functionInput);

    if (!func || !analyticalDerivative) return;

    const stepSizes = Array.from({ length: 20 }, (_, i) =>
      Math.pow(10, -4 + i * 0.2)
    );
    const traces: any[] = [];

    selectedMethods.forEach((methodName) => {
      const method = methods.find((m) => m.name === methodName);
      if (!method) return;

      const errors = stepSizes.map((h) => {
        const numerical = method.calculate(func, evaluationPoint, h);
        const analytical = analyticalDerivative(evaluationPoint);
        return Math.abs(numerical - analytical);
      });

      traces.push({
        x: stepSizes,
        y: errors,
        type: "scatter",
        mode: "lines+markers",
        name: `${methodName} Error`,
        line: { color: method.color },
        xaxis: "x",
        yaxis: "y",
      });
    });

    setErrorData(traces);
  }, [
    functionInput,
    evaluationPoint,
    selectedMethods,
    parseFunction,
    getAnalyticalDerivative,
  ]);

  // Update calculations when parameters change
  useEffect(() => {
    calculateDerivatives();
  }, [calculateDerivatives]);

  useEffect(() => {
    generatePlotData();
  }, [generatePlotData]);

  useEffect(() => {
    generateErrorData();
  }, [generateErrorData]);

  const handleMethodToggle = (methodName: string, checked: boolean) => {
    if (checked) {
      setSelectedMethods((prev) => [...prev, methodName]);
    } else {
      setSelectedMethods((prev) => prev.filter((m) => m !== methodName));
    }
  };

  const exportResults = () => {
    const data = {
      function: functionInput,
      evaluationPoint,
      stepSize: stepSize,
      results,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "numerical_differentiation_results.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <Calculator className="h-10 w-10 text-primary" />
            Numerical Differentiation Calculator
          </h1>
          <p className="text-lg text-gray-600">
            Interactive visualization tool for numerical differentiation methods
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Function & Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2" htmlFor="function">
                    Function f(x)
                  </Label>
                  <Input
                    id="function"
                    value={functionInput}
                    onChange={(e) => setFunctionInput(e.target.value)}
                    placeholder="e.g., x^2 + 2*x + 1"
                  />
                  {functionError && (
                    <Alert className="mt-2">
                      <AlertDescription>{functionError}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <div>
                  <Label className="mb-2" htmlFor="point">
                    Evaluation Point (x)
                  </Label>
                  <Input
                    id="point"
                    type="number"
                    value={evaluationPoint}
                    onChange={(e) => setEvaluationPoint(Number(e.target.value))}
                    step="0.1"
                  />
                </div>

                <div>
                  <Label className="mb-2" htmlFor="stepSize">
                    Step Size (h)
                  </Label>
                  <Input
                    id="stepSize"
                    type="number"
                    value={stepSize}
                    onChange={(e) => setStepSize(Number(e.target.value))}
                    step="0.1"
                  />
                  {/* <Slider
                    value={stepSize}
                    onValueChange={setStepSize}
                    min={0.001}
                    max={10}
                    step={1}
                    className="mt-2"
                  /> */}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Methods</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {methods.map((method) => (
                  <div key={method.name} className="flex items-start space-x-3">
                    <Checkbox
                      className="mt-0.5"
                      id={method.name}
                      checked={selectedMethods.includes(method.name)}
                      onCheckedChange={(checked) =>
                        handleMethodToggle(method.name, checked as boolean)
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={method.name}
                        className="text-sm font-medium"
                      >
                        {method.name}
                      </Label>
                      <p className="text-xs text-gray-500 font-mono">
                        {method.formula}
                      </p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {method.order}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visualization Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="tangent"
                    checked={showTangentLines}
                    onCheckedChange={(checked) => setShowTangentLines(checked)}
                  />
                  <Label className="mb-2" htmlFor="tangent">
                    Show Tangent Lines
                  </Label>
                </div>
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="error"
                    checked={showError}
                    onCheckedChange={(checked) => setShowError(checked)}
                  />
                  <Label className="mb-2" htmlFor="error">
                    Show Error Analysis
                  </Label>
                </div>
                <Button
                  onClick={exportResults}
                  className="w-full bg-transparent"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Results
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs defaultValue="plot" className="w-full">
              <TabsList>
                <TabsTrigger value="plot">Function Plot</TabsTrigger>
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="error">Error Analysis</TabsTrigger>
              </TabsList>

              <TabsContent value="plot">
                <Card>
                  <CardHeader>
                    <CardTitle>Function Visualization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-96">
                      <Plot
                        data={plotData}
                        layout={{
                          title: {
                            text: `f(x) = ${functionInput}`,
                            font: { size: 18 },
                          },
                          xaxis: {
                            title: { text: "x", font: { size: 14 } },
                          },
                          yaxis: {
                            title: { text: "f(x)", font: { size: 14 } },
                          },
                          showlegend: true,
                          autosize: true,
                          margin: { l: 50, r: 50, t: 50, b: 50 },
                        }}
                        config={{ responsive: true }}
                        style={{ width: "100%", height: "100%" }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="results">
                <Card>
                  <CardHeader>
                    <CardTitle>Numerical Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 p-2 text-left">
                              Method
                            </th>
                            <th className="border border-gray-300 p-2 text-left">
                              Formula
                            </th>
                            <th className="border border-gray-300 p-2 text-left">
                              Numerical
                            </th>
                            <th className="border border-gray-300 p-2 text-left">
                              Analytical
                            </th>
                            <th className="border border-gray-300 p-2 text-left">
                              Abs Error
                            </th>
                            <th className="border border-gray-300 p-2 text-left">
                              Rel Error (%)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((result, index) => (
                            <tr key={index}>
                              <td className="border border-gray-300 p-2">
                                <Badge
                                  style={{
                                    backgroundColor: result.color,
                                    color: "white",
                                  }}
                                >
                                  {result.method}
                                </Badge>
                              </td>
                              <td className="border border-gray-300 p-2 font-mono text-sm">
                                {result.formula}
                              </td>
                              <td className="border border-gray-300 p-2 font-mono">
                                {result.numerical.toFixed(6)}
                              </td>
                              <td className="border border-gray-300 p-2 font-mono">
                                {result.analytical?.toFixed(6) || "N/A"}
                              </td>
                              <td className="border border-gray-300 p-2 font-mono">
                                {result.absoluteError?.toExponential(3) ||
                                  "N/A"}
                              </td>
                              <td className="border border-gray-300 p-2 font-mono">
                                {result.relativeError?.toFixed(3) || "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="error">
                <Card>
                  <CardHeader>
                    <CardTitle>Error Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-96">
                      <Plot
                        data={errorData}
                        layout={{
                          title: {
                            text: "Error vs Step Size",
                            font: { size: 18 },
                          },
                          xaxis: {
                            title: {
                              text: "Step Size (h)",
                              font: { size: 14 },
                            },
                            type: "log",
                            autorange: true,
                          },
                          yaxis: {
                            title: {
                              text: "Absolute Error",
                              font: { size: 14 },
                            },
                            type: "log",
                            autorange: true,
                          },
                          showlegend: true,
                          autosize: true,
                          margin: { l: 50, r: 50, t: 50, b: 50 },
                        }}
                        config={{ responsive: true }}
                        style={{ width: "100%", height: "100%" }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
