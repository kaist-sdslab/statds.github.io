---
title: Statistical Data Science Lab
description: Statistical methodology for high-dimensional and complex data at KAIST, with an emphasis on interpretability.
hero:
  welcome: Welcome to Statistical Data Science Lab!
  description: In our lab, we develop statistical methodologies for high-dimensional, complex problems that arise in various scientific fields. We especially focus on enhanced interpretability of our statistical solutions.
research:
  - title: Transfer learning for high-dimensional data
    publication_topics: [transfer-learning, high-dimensional-data]
    description: |
      Analysis of high-dimensional data can be challenging because many statistical models require a large sample size compared to dimensionality for accurate estimation and inference. Along with target data of interest, we often may find an additional source dataset collected from another group with a large sample size.

      Our lab aims to improve the target data analysis results by leveraging such source data. We have developed a transfer learning framework for high-dimensional covariance matrix estimation based on spectral similarity between target and source data. Through improvements in covariance estimation, we may expect enhancements in downstream tasks such as PCA, LDA, and network analysis.
    image: media/research/transfer-learning.png
    image_alt: Target and source data matrices with their spectral decompositions, illustrating shared structure for transfer learning.
  - title: Compositional data analysis
    publication_topics: [compositional-data]
    description: |
      Compositional data consist of multivariate non-negative variables for which only relative information among components is meaningful, subject to a constant-sum constraint. They are defined on a simplex rather than in a Euclidean space. Log-ratio transformations encounter difficulties in the presence of zero components and may introduce distortions in the analysis results.

      Our lab develops methods to analyze compositional data with zeros without such limitations. We proposed a kernel density estimation method which guarantees convergence to the true density. We also studied an interpretable dimension reduction technique and a mean estimation method for high-dimensional compositional data often encountered in microbiome research.
    image: media/research/compositional-data.png
    image_alt: Density contours on a triangular simplex, with a magnified view near its boundary.
  - title: Synthetic data for data privacy
    publication_topics: [synthetic-data, data-privacy]
    description: |
      Many valuable datasets cannot be broadly shared as they contain privacy-sensitive information about individuals. Synthetic data has emerged as a practical solution for privacy-preserving data sharing. Our lab studies synthetic data generation methods across diverse data types.

      We develop methods that produce high-utility synthetic datasets by preserving statistical fidelity, including key distributions, dependencies, and higher-order structure, while ensuring domain validity through constraint-satisfying and internally consistent samples. We also aim to reduce privacy risks such as membership inference and attribute disclosure, thereby balancing utility and privacy.
    image: media/research/synthetic-data.png
    image_alt: A scatter plot comparing original data with synthetic observations classified by disclosure risk.
contact:
  title: Statistical Data Science Lab
  address: E2-2, KAIST, 291 Daehak-ro, Yuseong-gu, Daejeon, Republic of Korea
---
